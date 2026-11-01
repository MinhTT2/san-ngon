begin;
delete from user_activity_simulations;
commit;
select count(*) as simulated_usage_rows from user_activity_simulations;
