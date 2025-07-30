import constants from '@src/constants';
import { subMinutes } from 'date-fns/subMinutes';
import { format } from 'date-fns/format';

import {
  ISteamAgreement,
  ISteamAuthUserTicket,
  ISteamMicroCancelAgreement,
  ISteamMicroGetReport,
  ISteamMicroGetUserAgreementInfo,
  ISteamMicroGetUserInfo,
  ISteamMicroTx,
  ISteamOpenTransaction,
  ISteamOwnershipResponse,
  ISteamQueryTxResponse,
  ISteamTransaction,
  ISteamUserRequest,
  ISteamUserTicket,
  SteamOptions,
} from './steaminterfaces';

import { HttpClient } from '@src/lib/httpclient';

export default class SteamRequest {
  private options: SteamOptions;
  private interface: string;

  constructor(private httpClient: HttpClient) {
    this.options = {
      webkey: constants.webkey,
      appId: constants.steam_app_id,
      url: 'https://partner.steam-api.com/',
      version: 1,
    };

    this.interface = constants.development ? 'ISteamMicroTxnSandbox' : 'ISteamMicroTxn';
  }

  /**
   * Check if the User(steamid) owns the appid
   *
   * @param steamId
   * @param appId
   * @see https://partner.steamgames.com/doc/webapi/ISteamUser#CheckAppOwnership
   */
  async steamCheckAppOwnership(info: ISteamUserRequest): Promise<ISteamOwnershipResponse> {
    const data = {
      key: this.options.webkey,
      steamid: info.steamId,
      appid: this.options.appId,
    };

    return await this._get<ISteamOwnershipResponse>('ISteamUser', 'CheckAppOwnership', 2, data);
  }

  /**
   * @param info
   * @see https://partner.steamgames.com/doc/webapi/ISteamUserAuth#AuthenticateUserTicket
   */
  async steamAuthenticateUserTicket(info: ISteamUserTicket): Promise<ISteamAuthUserTicket> {
    const data = {
      key: this.options.webkey,
      appid: this.options.appId,
      ticket: info.ticket,
    };

    return await this._get('ISteamUserAuth', 'AuthenticateUserTicket', this.options.version, data);
  }

  /**
   * To check if user brought something on steam to avoid scammers
   * @param steamId
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#GetUserInfo
   */
  async steamMicrotransactionGetUserInfo(steamId: string): Promise<ISteamMicroGetUserInfo> {
    const data = {
      key: this.options.webkey,
      steamid: steamId,
    };

    return await this._get<ISteamMicroGetUserInfo>(this.interface, 'GetUserInfo', 2, data);
  }

  /**
   * Get Subscription Reports
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#GetReport
   */
  async steamMicrotransactionGetReport(): Promise<ISteamMicroGetReport> {
    const data = {
      key: this.options.webkey,
      appid: this.options.appId,
      type: 'SUBSCRIPTION',
      time: '',
      maxresults: '10000',
    };
    const now = new Date();
    //TODO change this so we avoid so many overlapping updates
    data.time = format(
      subMinutes(now, Number(constants.report_update_frequency) + 5 / 60), //add 5 seconds to avoid issues with the update interval missing reports
      "yyyy-MM-dd'T'HH:mm:ss'Z'"
    );

    console.log('Requesting report with time:', data.time);
    //data.time = format(subWeeks(now, 100), "yyyy-MM-dd'T'HH:mm:ss'Z'");
    //console.log(data.time);

    return await this._get<ISteamMicroGetReport>(this.interface, 'GetReport', 5, data);
  }

  /**
   * Get User Agreement Info
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#GetUserAgreementInfo
   */
  async steamMicrotransactionGetUserAgreementInfo(
    steamId: string
  ): Promise<ISteamMicroGetUserAgreementInfo> {
    const data = {
      key: this.options.webkey,
      steamid: steamId,
      appid: this.options.appId,
    };
    return await this._get<ISteamMicroGetUserAgreementInfo>(
      this.interface,
      'GetUserAgreementInfo',
      2,
      data
    );
  }

  /**
   * Cancel Agreement
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#CancelAgreement
   */
  async steamMicrotransactionCancelAgreement(
    info: ISteamAgreement
  ): Promise<ISteamMicroCancelAgreement> {
    const formData = new URLSearchParams({
      key: this.options.webkey,
      steamid: info.steamId,
      appid: this.options.appId,
      agreementid: info.agreementId,
    });
    return await this._post<ISteamMicroCancelAgreement>(
      this.interface,
      'CancelAgreement',
      1,
      formData
    );
  }

  /**
   * Initialize the microtransaction purchase.
   * If the user has the appid opened, the confirm purchase popup will appear
   * @params _transaction
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#InitTxn
   */
  async steamMicrotransactionInitWithOneItem(
    transaction: ISteamOpenTransaction
  ): Promise<ISteamMicroTx> {
    const formData = new URLSearchParams({
      key: this.options.webkey,
      orderid: transaction.orderId,
      steamid: transaction.steamId,
      appid: this.options.appId,
      itemcount: '1',
      currency: transaction.currency,
      language: transaction.language,
      usersession: 'client',
      'itemid[0]': transaction.itemId.toString(),
      'qty[0]': '1',
      'amount[0]': transaction.amount.toString(),
      'description[0]': transaction.description,
      'category[0]': 'Subscription',
      'billingtype[0]': 'Steam',
      'period[0]': transaction.period!,
      'frequency[0]': transaction.frequency!,
      'recurringamt[0]': transaction.amount.toString(), //this is "optional" but the API requires it...
    });

    return await this._post<ISteamMicroTx>(
      this.interface,
      'InitTxn',
      3,
      formData,
      `https://api.steampowered.com/`
    );
  }

  /**
   * Use to check the status of the transaction
   * @param info
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#QueryTxn
   */
  async steamMicrotransactionCheckRequest(info: ISteamTransaction): Promise<ISteamQueryTxResponse> {
    const data = {
      key: this.options.webkey,
      orderid: info.orderId,
      appid: this.options.appId,
      transid: info.transId,
    };

    return await this._get<ISteamQueryTxResponse>(this.interface, 'QueryTxn', 2, data);
  }

  /**
   * When the user confirms the transaction. One callback is called on the client-side. Use this callback to call finalize function
   *
   * @param appId
   * @param orderid
   * @see https://partner.steamgames.com/doc/webapi/ISteamMicroTxn#FinalizeTxn
   */
  async steamMicrotransactionFinalizeTransaction(orderid: string): Promise<ISteamMicroTx> {
    const formData = new URLSearchParams({
      key: this.options.webkey,
      orderid: orderid,
      appid: this.options.appId,
    });

    return await this._post<ISteamMicroTx>(this.interface, 'FinalizeTxn', 2, formData);
  }

  private async _get<T>(
    interf: string,
    method: string,
    version: number,
    data: Record<string, string>,
    url: string = this.options.url
  ): Promise<T> {
    const parsed = new URLSearchParams(data).toString();
    const urlRequested = `${url}${interf}/${method}/v${version}/?${parsed}`;
    return await this.httpClient.get<T>(urlRequested);
  }

  private async _post<T>(
    interf: string,
    method: string,
    version: number,
    data: URLSearchParams,
    url: string = this.options.url
  ): Promise<T> {
    const urlRequested = `${url}${interf}/${method}/v${version}/`;
    return await this.httpClient.post<T>(urlRequested, data);
  }
}
