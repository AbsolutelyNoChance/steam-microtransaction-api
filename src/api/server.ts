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

import mysql from 'mysql2/promise';

import { format } from 'date-fns/format';

import constants from '@src/constants';
import { ITransaction } from '@src/mysql/mysqlinterface';
import { parse } from 'date-fns/parse';

console.log('Creating Pool for MySQL database...');
console.log('Host:', constants.db_host);
console.log('User:', constants.db_username);
const pool = mysql.createPool({
  host: constants.db_host,
  user: constants.db_username,
  password: constants.db_password,
  database: 'steam_subscriptions',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
  idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  namedPlaceholders: true,
});

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
        console.log('Updating DB...');

        for (const order of report.response.params.orders) {
          const [rows, fields] = await pool.execute(
            'REPLACE INTO `TRANSACTION`(`orderid`, `transid`, `steamid`, `status`, `currency`, `country`, `timecreated`, `timeupdated`, `agreementid`, `agreementstatus`, `nextpayment`, `itemid`, `amount`, `vat`) VALUES(:orderid, :transid, :steamid, :status, :currency, :country, :timecreated, :timeupdated, :agreementid, :agreementstatus, :nextpayment, :itemid, :amount, :vat)',
            {
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
              nextpayment: order.nextpayment
                ? format(parse(order.nextpayment, 'yyyyMMdd', new Date()), 'yyyy-MM-dd')
                : null,
              itemid: order.items.map(item => item.itemid).join(','),
              amount: order.items.map(item => item.amount).join(','),
              vat: order.items.map(item => item.vat).join(','),
            } as unknown as ITransaction //need this because of the enums, I don't wanna deal with that right now
          );

          console.log('DB updated successfully', rows, fields);
        }

        const test = await pool.query<ITransaction[]>('SELECT * FROM transactions');
        console.log(test);
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
    console.log('Syncing subscription states...');
    syncSubscriptionStates().then().catch(console.error);
  }, 1000 * 60 * Number(constants.report_update_frequency)); // Gather data every X minutes

  return [app, serverListener];
};
