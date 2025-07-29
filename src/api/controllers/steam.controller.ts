import constants from '@src/constants';
import DBPool, { ITransaction } from '@src/mysql/mysqlinterface';
import {
  ISteamAgreement,
  ISteamOpenTransaction,
  ISteamOrder,
  ISteamTransaction,
  ISteamUserRequest,
  ISteamUserTicket,
} from '@src/steam/steaminterfaces';
import { NextFunction, Request, Response } from 'express';

// Improving type annotations for errors and response objects
interface CustomError extends Error {
  response?: {
    status?: number;
    error?: {
      errordesc?: string;
    };
  };
}

const validateError = (res: Response, err: CustomError): void => {
  const status = err?.response?.status ?? 400;

  if (status === 403) {
    res.status(403).json({ error: 'Invalid Steam WebKey' });
    return;
  }

  res.status(status).json({ error: err.message || 'Something went wrong' });
};

export default {
  authenticateUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { ticket }: ISteamUserTicket = req.body;
    const { steamId }: ISteamUserRequest = req.body;

    if (!ticket || !steamId) {
      res.status(400).json({ error: 'Missing auth fields' });
      return;
    }
    try {
      const check_auth = await req.steam.steamAuthenticateUserTicket({ ticket });

      const auth_success =
        check_auth.response?.params?.result === 'OK' &&
        check_auth.response?.params?.steamid === steamId;

      if (!auth_success) {
        throw new Error('Invalid authentication ticket');
      }

      next();
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  getReliableUserInfo: async (req: Request, res: Response): Promise<void> => {
    const { steamId } = req.body;
    if (!steamId) {
      res.status(400).json({ error: 'Invalid steamId' });
      return;
    }

    try {
      const data = await req.steam.steamMicrotransactionGetUserInfo(steamId);

      const success =
        data.response.result === 'OK' &&
        (data.response.params.status === 'Active' || data.response.params.status === 'Trusted');

      if (!success) {
        throw new Error(data.response?.error?.errordesc ?? 'Steam API returned unknown error');
      }

      res.status(200).json({ success, ...data.response.params });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  checkAppOwnership: async (req: Request, res: Response): Promise<void> => {
    const { steamId } = req.body;

    if (!steamId) {
      res.status(400).json({ error: 'Missing steamId field' });
      return;
    }

    try {
      const data = await req.steam.steamCheckAppOwnership({ steamId });

      const success = data.appownership.result === 'OK' && data.appownership.ownsapp;

      if (!success) {
        throw new Error('The specified steamId has not purchased the app');
      }

      res.status(200).json({ success });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  initPurchase: async (req: Request, res: Response): Promise<void> => {
    const { language, currency, itemId, steamId }: ISteamOpenTransaction = req.body;

    if (!language || !currency || !itemId || !steamId) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    const product = constants.products.find(p => p.id === itemId);
    //Get corresponding product from constants
    if (product === undefined) {
      res.status(400).json({ error: 'ItemId not found in the game database' });
      return;
    }

    //Compute used currency, default to USD if not found
    let usedCurrency = 'USD';
    if (product.price_per_currency.has(currency)) {
      usedCurrency = currency;
    } else {
      console.log(`Currency ${currency} not found for product ${itemId}, using default USD`);
    }

    // Get price for the product in the specified currency
    const price = product.price_per_currency.get(usedCurrency);

    //generates a twitter snowflake ID
    function generate(): string {
      const timestamp = Date.now();
      const epoch = Date.UTC(2020, 0, 1).valueOf();
      const shard_id = 420;

      // tslint:disable:no-bitwise
      let result = (BigInt(timestamp) - BigInt(epoch)) << BigInt(22);
      result = result | (BigInt(shard_id % 1024) << BigInt(12));
      result = result | BigInt(constants.sequence++ % 4096);
      // tslint:enable:no-bitwise
      return result.toString();
    }

    const orderId = generate();
    console.log(`Generated Order ID: ${orderId}`);

    try {
      const check_app_ownership = await req.steam.steamCheckAppOwnership({ steamId });

      const app_ownership_success =
        check_app_ownership.appownership.result === 'OK' &&
        check_app_ownership.appownership.ownsapp;

      if (!app_ownership_success) {
        throw new Error('The specified steamId has not purchased the provided appId');
      }

      const data = await req.steam.steamMicrotransactionInitWithOneItem({
        amount: price,
        description: product.description,
        itemId,
        orderId,
        steamId,
        language,
        currency: usedCurrency,
        frequency: product.frequency,
        period: product.period,
      });

      const success = data.response.result === 'OK' && data.response.params.transid;

      /* Can't do this because the API doesn't return the needed agreementID even though it should
      console.log('Transaction data:', data);
      DBPool.getInstance()
        .getPool()
        .execute(
          'INSERT INTO `SUBSCRIPTION`(`orderid`, `steamid`, `status`, `agreementid`, `type`, `startdate`, `enddate`) VALUES(:orderid, :steamid, :status, :agreementid, :type, :startdate, :enddate)',
          {
            orderid: orderId,
            steamid: steamId,
            status: 'active', //this is janky, I don't understand why it adds double quotes otherwise
            agreementid:
              data.response.params.agreements && data.response.params.agreements[0]?.agreementid,
            type: product.type,
            startdate: format(new Date(), 'yyyy-MM-dd'),
            enddate: format(new Date(), 'yyyy-MM-dd'),
          } as unknown as ISubscription
        );
      */
      if (!success) {
        throw new Error(data.response?.error?.errordesc ?? 'Steam API returned unknown error');
      }

      res.status(200).json({ transid: data.response.params.transid });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  checkPurchaseStatus: async (req: Request, res: Response): Promise<void> => {
    const { orderId, transId }: ISteamTransaction = req.body;

    if (!orderId || !transId) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    try {
      const data = await req.steam.steamMicrotransactionCheckRequest({ orderId, transId });

      if (data.response?.result !== 'OK') {
        throw new Error(data.response?.error?.errordesc ?? 'Steam API returned unknown error');
      }

      res.status(200).json({ success: true, ...data.response.params });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  finalizePurchase: async (req: Request, res: Response): Promise<void> => {
    const { orderId }: ISteamOrder = req.body;

    if (!orderId) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    try {
      const data = await req.steam.steamMicrotransactionFinalizeTransaction(orderId);

      res.status(200).json({
        success: data.response.result === 'OK',
        ...(data.response?.error ? { error: data.response?.error?.errordesc } : {}),
      });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  cancelAgreement: async (req: Request, res: Response): Promise<void> => {
    const { steamId, agreementId }: ISteamAgreement = req.body;

    if (!steamId || !agreementId) {
      res.status(400).json({ error: 'Missing fields' });
      return;
    }

    try {
      const data = await req.steam.steamMicrotransactionCancelAgreement({ steamId, agreementId });

      if (data.response?.result !== 'OK') {
        throw new Error(data.response?.error?.errordesc ?? 'Steam API returned unknown error');
      }

      res.status(200).json({ success: true, ...data.response.params });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },

  getUserAgreementInfo: async (req: Request, res: Response): Promise<void> => {
    const { steamId }: ISteamUserRequest = req.body;

    if (!steamId) {
      res.status(400).json({ error: 'Missing steamId field' });
      return;
    }

    try {
      //Steamworks documentation tells us to use GetReport for tracking of recurring billing but it just doesn't give enough info.
      //Scenario: A user cancels his subscription in the Steam UI
      //Consequence: We get zero information through the GetReport API about this cancellation.
      //Solution: Use GetUserAgreementInfo to get the current status of the subscription and then read our saved GetReport transactions to get the history of the subscription.
      const data = await req.steam.steamMicrotransactionGetUserAgreementInfo(steamId);

      console.log('User Agreement Info:', data);

      if (data.response?.result !== 'OK') {
        throw new Error(data.response?.error?.errordesc ?? 'Steam API returned unknown error');
      }

      //There's only one agreement active at the same time (Steam guarantee)
      const agreement = data.response.params.agreements['agreement[0]'];

      DBPool.getInstance()
        .getPool()
        .execute(
          'SELECT * FROM `TRANSACTION` WHERE `steamid` = ":steamid" AND `agreementid` = ":agreementid" ORDER BY `TRANSACTION`.`timeupdated` DESC LIMIT 1',
          {
            steamid: steamId,
            agreementid: agreement.agreementid,
          }
        )
        .then(([rows]) => {
          const transaction = rows as ITransaction[];

          console.log('Fetched transaction:', transaction);

          if (transaction.length === 0) {
            res.status(200).json({
              success: false,
              message: 'No transactions found',
              agreementid: agreement.agreementid,
            });
            return;
          }

          const validTransaction = transaction.filter(
            sub => sub.status === 'Approved' || sub.status === 'Succeeded'
          );

          if (validTransaction.length === 0) {
            res.status(200).json({
              success: false,
              message: 'No valid transactions found',
              agreementid: agreement.agreementid,
            });
            return;
          }
          res.status(200).json({
            success: true,
            transaction: validTransaction,
            agreement: agreement,
          });
        })
        .catch(err => {
          console.error('Error fetching subscriptions:', err);
          res.status(500).json({ error: 'Internal server error' });
        });
    } catch (err) {
      validateError(res, err as CustomError);
    }
  },
};
