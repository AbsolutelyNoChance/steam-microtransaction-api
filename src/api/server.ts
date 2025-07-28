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

import mysql, {
  ConnectionOptions,
} from 'mysql2/promise';

import constants from '@src/constants';
import { ISubscription } from '@src/mysql/mysqlinterface';

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

  (async () => {
    console.log('Connecting to MySQL database...');
    console.log('Using credentials:');
    console.log('Host:', constants.db_host);
    console.log('User:', constants.db_username);
    console.log('Password:', constants.db_password);
    const access: ConnectionOptions = {
      host: constants.db_host,
      user: constants.db_username,
      password: constants.db_password,
      database: 'steam_subscriptions',
      //port: 3306,
    };

    const conn = await mysql.createConnection(access);

    /** Inserting some transactions */
    //const [inserted] = await conn.execute<ResultSetHeader>(
    //  'INSERT INTO `SUBSCRIPTION`(`name`) VALUES(?), (?), (?), (?);',
    //  ['Josh', 'John', 'Marie', 'Gween']
    //);

    //console.log('Inserted:', inserted.affectedRows);

    /** Getting users */
    const [users] = await conn.query<ISubscription[]>(
      'SELECT * FROM `SUBSCRIPTION` ORDER BY `steamid` ASC;'
    );

    users.forEach((user) => {
      console.log('-----------');
      console.log('id:  ', user.id);
      console.log('name:', user.name);
    });

    await conn.end();
  })();

  async function syncSubscriptionStates() {
    await new SteamRequest(httpclient)
      .steamMicrotransactionGetReport()
      .then(report => {
        //TODO implement this
        console.log(report);
      })
      .catch(err => {
        console.error('Error syncing subscription states:', err);
      });
  }

  setInterval(function sync() {
    console.log('Syncing subscription states...');
    syncSubscriptionStates().then().catch(console.error);
  }, 1000 * 60 * 1); // Gather data every minute

  return [app, serverListener];
};
