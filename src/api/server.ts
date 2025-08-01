import * as dotenv from 'dotenv';
dotenv.config();

import cors from 'cors';
import express, { Express } from 'express';

import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import routes from './routes';

import SteamRequest from '@src/steam/steamrequest';
import httpclient from '@src/lib/httpclient';
import { IncomingMessage, Server, ServerResponse } from 'http';

import hpp from 'hpp';
import xssClean from 'xss-clean';

import mongoSanitize from 'express-mongo-sanitize';

import { format } from 'date-fns/format';

import constants from '@src/constants';
import { parse } from 'date-fns/parse';

import DBPool, { ITransaction } from '@src/mysql/mysqlinterface';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      steam: SteamRequest;
    }
  }
}

export default (
  app: Express,
  host: string,
  port: number | string
): [Express, Server<typeof IncomingMessage, typeof ServerResponse>] => {
  // Trust the reverse proxy (important for Heroku and rate limiting)
  app.set('trust proxy', 1);
  // CORS options
  const corsOptions = {
    origin: ['*'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept'],
    optionsSuccessStatus: 200,
  };

  // Enable CORS
  app.use(cors(corsOptions));

  // Enable Helmet to add security-related HTTP headers
  app.use(helmet());

  // Disable 'X-Powered-By' to prevent attackers from knowing the framework
  app.disable('x-powered-by');

  // Enable rate limiting to prevent brute force attacks
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use(limiter);

  // Prevent HTTP Parameter Pollution
  app.use(hpp());

  // Prevent Cross-site Scripting (XSS) attacks
  app.use(xssClean());

  // Prevent NoSQL Injection / Sanitize user input coming from POST body, GET queries, etc.
  app.use(mongoSanitize());

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom middleware to add SteamRequest to request object
  app.use((_req, _res, next) => {
    _req.steam = new SteamRequest(httpclient);
    next();
  });

  // Setting routes
  routes(app);

  // Enable request logging with Morgan
  app.use(morgan('combined'));

  // Start the server
  const serverListener = app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server ${host} started at port:${port}`);
  });

  async function syncSubscriptionStates() {
    await new SteamRequest(httpclient)
      .steamMicrotransactionGetReport()
      .then(async report => {
        //console.log('Updating DB...');

        for (const order of report.response.params.orders) {
          const nextPayment = order.nextpayment
            ? format(parse(order.nextpayment, 'yyyyMMdd', new Date()), 'yyyy-MM-dd')
            : null;

          /*let subscriptionStatus = 'failed';

          if (order.agreementstatus === 'Canceled' || order.agreementstatus === 'Inactive') {
            subscriptionStatus = 'cancelled';
          } else if (order.agreementstatus === 'Active' || order.agreementstatus === 'Processing') {
            subscriptionStatus = 'active';
          } else if (order.agreementstatus === 'Failed') {
            subscriptionStatus = 'failed';
          }

          if (order.status === 'Failed') {
            nextPayment = null;
          } else if (
            order.status === 'Refunded' ||
            order.status === 'PartialRefund' ||
            order.status === 'RefundedSuspectedFraud' ||
            order.status === 'RefundedFriendlyFraud' ||
            order.status === 'Chargedback'
          ) {
            nextPayment = null;
            subscriptionStatus = 'cancelled';
          } else if (order.status === 'Succeeded' || order.status === 'Approved') {
            // If the order is succeeded or approved, everything is fine
          }
          */

          const query_data = {
            orderid: order.orderid,
            transid: order.transid,
            steamid: order.steamid,
            status: order.status,
            currency: order.currency,
            country: order.country,
            timecreated: format(order.timecreated, 'yyyy-MM-dd HH:mm:ss'),
            timeupdated: format(order.time, 'yyyy-MM-dd HH:mm:ss'),
            agreementid: order.agreementid,
            agreementstatus: order.agreementstatus,
            nextpayment: nextPayment,
            itemid: order.items.map(item => item.itemid).join(','),
            amount: order.items.map(item => item.amount).join(','),
            vat: order.items.map(item => item.vat).join(','),
          } as unknown as ITransaction; //need this because of the enums, I don't wanna deal with that right now

          //console.log(query_data);

          await DBPool.getInstance()
            .getPool()
            .execute(
              'REPLACE INTO `TRANSACTION`(`orderid`, `transid`, `steamid`, `status`, `currency`, `country`, `timecreated`, `timeupdated`, `agreementid`, `agreementstatus`, `nextpayment`, `itemid`, `amount`, `vat`) VALUES(:orderid, :transid, :steamid, :status, :currency, :country, :timecreated, :timeupdated, :agreementid, :agreementstatus, :nextpayment, :itemid, :amount, :vat)',
              query_data
            );

          /*await DBPool.getInstance()
            .getPool()
            .execute(
              'UPDATE `SUBSCRIPTION` SET `status` = :status, `enddate` = COALESCE(:enddate, enddate) WHERE `steamid` = ":steamid" AND `agreementid` = ":agreementid"',
              {
                orderid: order.orderid,
                steamid: order.steamid,
                status: subscriptionStatus,
                agreementid: order.agreementid,
                enddate: nextPayment ? `"${nextPayment}"` : null, //formatting issues, need to quote strings for index to work properly
              } as unknown as ISubscription //need this because of the enums, I don't wanna deal with that right now
            );
          */
        }
      })
      .catch(err => {
        console.error('Error syncing subscription states:', err);
      });
  }

  console.log(
    'Starting subscription state sync with interval of',
    constants.report_update_frequency,
    'minutes'
  );
  setInterval(function sync() {
    syncSubscriptionStates().then().catch(console.error);
  }, 1000 * 60 * Number(constants.report_update_frequency)); // Gather data every X minutes

  return [app, serverListener];
};
