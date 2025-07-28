export declare interface SteamOptions {
  webkey: string;
  appId: string;
  url: string;
  version: number;
}

export declare interface ISteamUserRequest {
  // steam user id
  steamId: string;
}

export declare interface ISteamUserTicket {
  ticket: string;
}

export declare interface ISteamOrder {
  orderId: string;
}

export declare interface ISteamAgreement extends ISteamUserRequest {
  agreementId: string;
}

export declare interface ISteamTransaction extends ISteamOrder {
  transId: string;
}

export declare interface ISteamOpenTransaction extends ISteamUserRequest {
  language: string;
  currency: string;
  itemId: number;
  orderId: string;
  amount: number;
  description: string;
  frequency?: string;
  period?: string;
}

export declare interface ISteamOwnershipResponse {
  appownership: {
    ownsapp: boolean;
    permanent: boolean;
    timestamp: string;
    ownersteamid: string;
    sitelicense: boolean;
    result: string;
  };
}

export declare interface ISteamMicroGetUserInfo {
  response: {
    result: 'OK' | 'Failure';
    params: {
      state: string;
      country: string;
      currency: string;
      status: string;
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}

export declare interface ISteamAuthUserTicket {
  response: {
    params: {
      result: 'OK' | 'Failure';
      steamid: string;
      ownersteamid: string;
      vacbanned: boolean;
      publisherbanned: boolean;
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}

export declare interface ISteamMicroGetReport {
  response: {
    result: 'OK' | 'Failure';
    params: {
      count: number;
      orders: ISteamTxReport[];
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}

export declare interface ISteamMicroCancelAgreement {
  response: {
    result: 'OK' | 'Failure';
    params: {
      agreementid: string;
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}

export declare interface ISteamMicroGetUserAgreementInfo {
  response: {
    result: 'OK' | 'Failure';
    params: {
      agreements: {
        agreementid: string;
        itemid: string;
        status: string;
        period: string;
        frequency: string;
        startdate: string;
        enddate: string;
        recurringamt: string;
        currency: string;
        timecreated: string;
        lastpayment: string;
        lastamount: string;
        nextpayment: string;
        outstanding: string;
        failedattempts: number;
      }[];
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}

export declare interface ISteamTxReport {
  orderid: string;
  transid: string;
  steamid: string;
  status: string;
  currency: string;
  time: string;
  country: string;
  usstate: string;
  timecreated: string;
  agreementid: string;
  agreementstatus: string;
  nextpayment?: string;
  items: {
    itemid: string;
    qty: number;
    amount: string;
    vat: string;
    itemstatus: string;
  }[];
}

export declare interface ISteamMicroTx {
  response: {
    result: 'OK' | 'Failure';
    params: {
      orderid: string;
      transid: string;
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}

export declare interface ISteamQueryTxResponse {
  response: {
    result: 'OK' | 'Failure';
    params: {
      orderid: string;
      transid: string;
      steamid: string;
      status: string;
      currency: string;
      time: string;
      country: string;
      usstate: string;
      items: [
        {
          itemid: string;
          qty: number;
          amount: string;
          vat: string;
          itemstatus: string;
        }
      ];
    };
    error: {
      errorcode: string;
      errordesc: string;
    };
  };
}
