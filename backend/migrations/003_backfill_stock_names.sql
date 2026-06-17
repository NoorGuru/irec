-- 003_backfill_stock_names.sql
-- Backfills stock_name for tickers that were missing company names.
-- Applied 2026-06-17.

UPDATE recommendations SET stock_name = CASE ticker
    WHEN 'AEP' THEN 'American Electric Power'
    WHEN 'BE' THEN 'Bloom Energy'
    WHEN 'CEG' THEN 'Constellation Energy'
    WHEN 'CELH' THEN 'Celsius'
    WHEN 'CLS' THEN 'Celestica'
    WHEN 'CRDO' THEN 'CREDO Technology'
    WHEN 'DLR' THEN 'Digital Realty'
    WHEN 'HOOD' THEN 'Robinhood'
    WHEN 'ISRG' THEN 'Intuitive Surgical'
    WHEN 'MELI' THEN 'MercadoLibre'
    WHEN 'NESR' THEN 'National Energy Services'
    WHEN 'NLR' THEN 'VanEck Uranium+Nuclear ETF'
    WHEN 'NU' THEN 'Nu Holdings'
    WHEN 'RRR' THEN 'Red Rock Resorts'
    WHEN 'SPCX' THEN 'SPCX'
    WHEN 'TMUS' THEN 'T-Mobile'
    WHEN 'TSM' THEN 'TSMC'
    WHEN 'VRT' THEN 'Vertiv'
    ELSE stock_name
END
WHERE (stock_name = '' OR stock_name IS NULL)
AND ticker IN ('AEP','BE','CEG','CELH','CLS','CRDO','DLR','HOOD','ISRG','MELI','NESR','NLR','NU','RRR','SPCX','TMUS','TSM','VRT');
