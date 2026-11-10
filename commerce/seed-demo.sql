-- Optional testnet demo catalog. Replace with merchant products before launch.
INSERT INTO commerce_products(slug,name,description,category,fulfillment_type,price_usdc,stock_on_hand)
VALUES
('studio-pass','Studio day pass','Digital admission for one creative studio session.','Experiences','DIGITAL',24000000,25),
('creator-workshop','Creator workshop','Digital entry for our 90-minute workshop.','Experiences','DIGITAL',48000000,40),
('coffee-pickup','Coffee pickup','One prepared cold brew to collect at the merchant counter.','Pickup','PICKUP',6000000,60)
ON CONFLICT(slug) DO NOTHING;
