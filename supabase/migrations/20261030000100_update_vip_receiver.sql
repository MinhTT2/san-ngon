begin;

-- Rotate the dedicated VIP receiver without changing already-created purchases.
-- Each purchase keeps its own bank/account/name snapshot for reconciliation.
update public.vip_receiver
set bank = 'TPBank',
    account_number = '03411092005',
    account_name = 'HOANG DINH LAM'
where singleton = true;

commit;
