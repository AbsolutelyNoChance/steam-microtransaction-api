import { RowDataPacket } from 'mysql2';
import mysql from 'mysql2/promise';

import constants from '@src/constants';

class DBPool {
    private static instance: DBPool;
    private pool: mysql.Pool;

    private constructor() {
        console.log('Creating Pool for MySQL database...');
        console.log('Host:', constants.db_host);
        console.log('User:', constants.db_username);
        this.pool = mysql.createPool({
            host: constants.db_host,
            user: constants.db_username,
            password: constants.db_password,
            database: 'steam_subscriptions',
            waitForConnections: true,
            connectionLimit: 10,
            maxIdle: 10,
            idleTimeout: 60000,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
            namedPlaceholders: true,
        });
    }

    static getInstance(): DBPool {
        if (!DBPool.instance) {
            DBPool.instance = new DBPool();
        }
        return DBPool.instance;
    }

    getPool(): mysql.Pool {
        return this.pool;
    }
}

export default DBPool;

export interface ITransaction extends RowDataPacket {
    orderid: string;
    transid: string;
    steamid: string;
    status:
    | 'Init'
    | 'Approved'
    | 'Succeeded'
    | 'Failed'
    | 'Refunded'
    | 'PartialRefund'
    | 'Chargedback'
    | 'RefundedSuspectedFraud'
    | 'RefundedFriendlyFraud';
    currency: string;
    country: string;
    timecreated: Date;
    timeupdated: Date;
    agreementid: string;
    agreementstatus: string;
    nextpayment?: Date;
    itemid: number;
    amount: number;
    vat: number;
}

export interface ISubscription extends RowDataPacket {
    steamid: string;
    agreementid: string;
    type: 'yearly' | 'monthly';
    status: 'active' | 'non_renewing' | 'cancelled' | 'failed';
    startdate: Date;
    enddate: Date;
}
