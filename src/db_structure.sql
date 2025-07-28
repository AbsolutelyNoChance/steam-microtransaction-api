CREATE TABLE TRANSACTION (
  orderid VARCHAR(20) NOT NULL,
  transid VARCHAR(20) PRIMARY KEY,
  steamid VARCHAR(20) NOT NULL,
  status ENUM('Init', 'Approved', 'Succeeded', 'Failed', 'Refunded', 'PartialRefund', 'Chargedback', 'RefundedSuspectedFraud', 'RefundedFriendlyFraud') NOT NULL,
  currency VARCHAR(3) NOT NULL,
  country VARCHAR(2) NOT NULL,
  timecreated DATETIME NOT NULL,
  timeupdated DATETIME NOT NULL,
  agreementid VARCHAR(20) NOT NULL,
  agreementstatus VARCHAR(32) NOT NULL, #Active, Inactive, Canceled, Failed and possibly more, undocumented...
  nextpayment DATE, #undocumented, sometimes it's not present
  itemid SMALLINT NOT NULL,
  amount INT NOT NULL,
  vat INT NOT NULL
);

CREATE TABLE SUBSCRIPTION (
  steamId VARCHAR(20) NOT NULL,
  agreementId VARCHAR(20) PRIMARY KEY,
  type ENUM('yearly', 'monthly') NOT NULL,
  status ENUM('active', 'non_renewing', 'cancelled', 'failed') NOT NULL,
  startdate DATE NOT NULL,
  enddate DATE NOT NULL
);

# Privileges for `api`@`%`
GRANT SELECT, INSERT, UPDATE ON *.* TO `api`@`%`;
GRANT SELECT, INSERT, UPDATE, REFERENCES, LOCK TABLES ON `steam\_subscriptions`.* TO `api`@`%`;