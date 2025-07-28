import { RowDataPacket } from 'mysql2';

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
