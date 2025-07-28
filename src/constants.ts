import JSONProducts from './products.json';

export interface SubscriptionProduct {
  id: number;
  description: string;
  price_per_currency: Map<string, number>;
  period: string;
  frequency: string;
}

const products: SubscriptionProduct[] = (JSONProducts as any[]).map((product) => ({
  ...product,
  price_per_currency: new Map(
    Object.entries(product.price_per_currency)
  ),
}));

export default {
  /**
   *  Don't forget to generate your own steam webkey
   *  To generate the proper key, you need to implement the WebAPIKey from
   *  Steam Developer Page, User&Permissions -> Manage Group -> (Your App's name)
   */
  webkey: process.env.STEAM_WEBKEY,
  /**
   *  Define the list of products to be used by the transaction system to prevent users to send lower or higher price
   *  for these products.
   */
  products,
  /**
   * Useful during transaction creation
   * Steam automatically converts from this currency to the user local currency.
   * But you can change as you please.
   * See https://partner.steamgames.com/doc/store/pricing/currencies
   */
  currency: process.env.STEAM_CURRENCY || 'USD',
  /**
   * Used to define the locale of the item
   */
  locale: process.env.STEAM_ITEM_LOCALE || 'en',
  /**
   * The Steam App ID.
   * This is used to identify the app in the Steam ecosystem.
   */
  steam_app_id: process.env.STEAM_APP_ID || '480',

  db_username: process.env.MYSQL_USER,

  db_password: process.env.MYSQL_PASSWORD,

  db_host: process.env.MYSQL_HOST,

  /**
   * Set true if you want to enable sandbox mode
   * Please check https://partner.steamgames.com/doc/webapi/ISteamMicroTxnSandbox for more info
   */
  development: process.env.NODE_ENV == 'test' || process.env.NODE_ENV === 'development',

  sequence: 100,
};
