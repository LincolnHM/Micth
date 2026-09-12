-- ─── MICHT Decants — Columna "dupe_of" (Se parece a / perfume que dupea) (2026-09-12) ─
--
-- Pega esto en Supabase → SQL Editor → Run. Seguro de ejecutar más de una vez.
--
-- Guarda, para los perfumes árabes que son dupes/clones confirmados de un
-- perfume de diseñador famoso, el nombre + marca + foto pequeña del original,
-- que se muestra en la ficha del producto como tarjeta "SE PARECE A" debajo
-- de la foto principal. Formato:
-- { "name": "Sauvage", "brand": "Dior", "imageUrl": "/img PERFUMES/Dior_Sauvage.png" }
-- Si un producto no tiene dupe confirmado, esta columna queda vacía ('{}') y
-- la tarjeta simplemente no se muestra.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS dupe_of JSONB DEFAULT '{}'::jsonb;

-- La tabla tiene GRANT SELECT por columnas para el rol anon (ver
-- 2026-08-04b-ocultar-cost-price.sql) — sin esto, el catálogo público no
-- podría leer el dato aunque la columna exista.
GRANT SELECT (dupe_of) ON productos TO anon;

-- ─── Pares "se parece a" ya investigados (2026-09-12) ─────────────────────────
--
-- Estos 39 perfumes árabes ya estaban sembrados en Supabase desde antes, así
-- que el cambio en js/data.js (DEFAULT_PRODUCTS) no les llega solo con el
-- push de código — hace falta este UPDATE por producto (mismo motivo que en
-- 2026-09-08b-tamano-2ml.sql). Los pares se investigaron uno por uno (fuentes
-- públicas: Fragrantica, Parfumo, reseñas dedicadas, comunidad de fragancias)
-- — no son adivinados. Los que quedan con "imageUrl":"" son perfumes
-- originales que NO están en el catálogo de MICHT, así que la tarjeta se
-- muestra solo con el nombre hasta que subas la foto correspondiente desde
-- el panel admin (sección "Se Parece A" en Editar Perfume).
--
-- Puedes corregir o borrar cualquiera de estos pares en cualquier momento
-- desde el panel admin, sin tocar SQL — esta carga inicial es solo el punto
-- de partida.

UPDATE productos SET dupe_of = '{"name":"Erba Pura","brand":"Xerjoff","imageUrl":"/img PERFUMES/erba_pura.png"}'::jsonb WHERE id = 19; -- Bharara King -> Erba Pura
UPDATE productos SET dupe_of = '{"name":"God of Fire","brand":"Stephane Humbert Lucas","imageUrl":"/img PERFUMES/God_of_Fire.png"}'::jsonb WHERE id = 20; -- Sceptre Malachite -> God of Fire
UPDATE productos SET dupe_of = '{"name":"Erba Pura","brand":"Xerjoff","imageUrl":"/img PERFUMES/erba_pura.png"}'::jsonb WHERE id = 21; -- Amber Oud Gold Edition -> Erba Pura
UPDATE productos SET dupe_of = '{"name":"Althaïr","brand":"Parfums de Marly","imageUrl":"/img PERFUMES/Althair.webp"}'::jsonb WHERE id = 22; -- Liquid Brun -> Althaïr
UPDATE productos SET dupe_of = '{"name":"Ultra Male","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Ultra_Male.avif"}'::jsonb WHERE id = 23; -- 9PM -> Ultra Male
UPDATE productos SET dupe_of = '{"name":"Bad Boy Cobalt","brand":"Carolina Herrera","imageUrl":"/img PERFUMES/Bad_Boy_Cobalt.avif"}'::jsonb WHERE id = 25; -- 9AM Dive -> Bad Boy Cobalt
UPDATE productos SET dupe_of = '{"name":"Le Male Elixir","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Le_Male_Elixir.png"}'::jsonb WHERE id = 26; -- 9PM Elixir -> Le Male Elixir
UPDATE productos SET dupe_of = '{"name":"Angels'' Share","brand":"Kilian","imageUrl":"/img PERFUMES/Angels_Share.png"}'::jsonb WHERE id = 29; -- Khamrah Qahwa -> Angels' Share
UPDATE productos SET dupe_of = '{"name":"Angels'' Share","brand":"Kilian","imageUrl":"/img PERFUMES/Angels_Share.png"}'::jsonb WHERE id = 30; -- Khamrah Dukhan -> Angels' Share
UPDATE productos SET dupe_of = '{"name":"Angels'' Share","brand":"Kilian","imageUrl":"/img PERFUMES/Angels_Share.png"}'::jsonb WHERE id = 31; -- Khamrah -> Angels' Share
UPDATE productos SET dupe_of = '{"name":"Le Male Elixir","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Le_Male_Elixir.png"}'::jsonb WHERE id = 33; -- Hawas Elixir -> Le Male Elixir
UPDATE productos SET dupe_of = '{"name":"Invictus Aqua","brand":"Paco Rabanne","imageUrl":"/img PERFUMES/Invictus_Aqua.webp"}'::jsonb WHERE id = 34; -- Hawas Ice -> Invictus Aqua
UPDATE productos SET dupe_of = '{"name":"Invictus Aqua","brand":"Paco Rabanne","imageUrl":"/img PERFUMES/Invictus_Aqua.webp"}'::jsonb WHERE id = 35; -- Hawas For Him -> Invictus Aqua
UPDATE productos SET dupe_of = '{"name":"Sauvage Elixir","brand":"Dior","imageUrl":"/img PERFUMES/Sauvage_Elixir_Dior.webp"}'::jsonb WHERE id = 39; -- Asad Elixir -> Sauvage Elixir
UPDATE productos SET dupe_of = '{"name":"The Most Wanted (Parfum)","brand":"Azzaro","imageUrl":"/img PERFUMES/The_Most_Wanted.png"}'::jsonb WHERE id = 40; -- Asad Bourbon -> The Most Wanted (Parfum)
UPDATE productos SET dupe_of = '{"name":"Scandal Pour Homme","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Scandal_Pour_Homme.webp"}'::jsonb WHERE id = 41; -- Mandarin Sky -> Scandal Pour Homme
UPDATE productos SET dupe_of = '{"name":"Y EDP","brand":"Yves Saint Laurent","imageUrl":"/img PERFUMES/Y_EDP.png"}'::jsonb WHERE id = 42; -- Odyssey Mega -> Y EDP
UPDATE productos SET dupe_of = '{"name":"Invictus Platinum","brand":"Paco Rabanne","imageUrl":"/img PERFUMES/Invictus_Platinum.png"}'::jsonb WHERE id = 43; -- Odyssey Aqua -> Invictus Platinum
UPDATE productos SET dupe_of = '{"name":"Stronger With You","brand":"Giorgio Armani","imageUrl":"/img PERFUMES/Stronger_With_You.webp"}'::jsonb WHERE id = 44; -- Odyssey White -> Stronger With You
UPDATE productos SET dupe_of = '{"name":"Afternoon Swim","brand":"Louis Vuitton","imageUrl":"/img PERFUMES/Afternoon_Swim_LV.webp"}'::jsonb WHERE id = 45; -- Odyssey Limoni -> Afternoon Swim
UPDATE productos SET dupe_of = '{"name":"Her","brand":"Burberry","imageUrl":"/img PERFUMES/Her_Burberry.webp"}'::jsonb WHERE id = 50; -- Odyssey Candee -> Her
UPDATE productos SET dupe_of = '{"name":"Bianco Latte","brand":"Giardini di Toscana","imageUrl":"/img PERFUMES/Bianco_Latte.webp"}'::jsonb WHERE id = 51; -- Eclaire -> Bianco Latte
UPDATE productos SET dupe_of = '{"name":"Yum Boujee Marshmallow","brand":"Kayali","imageUrl":"/img PERFUMES/Yum_Boujee_Marshmallow.webp"}'::jsonb WHERE id = 54; -- Yara Elixir -> Yum Boujee Marshmallow
UPDATE productos SET dupe_of = '{"name":"Perfect Intense","brand":"Marc Jacobs","imageUrl":"/img PERFUMES/Perfect_Intense.avif"}'::jsonb WHERE id = 55; -- Yara Moi -> Perfect Intense
UPDATE productos SET dupe_of = '{"name":"Delina","brand":"Parfums de Marly","imageUrl":"/img PERFUMES/Delina.webp"}'::jsonb WHERE id = 59; -- Delilah -> Delina
UPDATE productos SET dupe_of = '{"name":"Imagination","brand":"Louis Vuitton","imageUrl":"/img PERFUMES/Imagination_LV.webp"}'::jsonb WHERE id = 76; -- Hawas Kobra -> Imagination
UPDATE productos SET dupe_of = '{"name":"Erba Pura","brand":"Xerjoff","imageUrl":"/img PERFUMES/erba_pura.png"}'::jsonb WHERE id = 77; -- Hawas Chrome -> Erba Pura
UPDATE productos SET dupe_of = '{"name":"Le Beau Le Parfum","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Le_Beau_Le_Parfum.png"}'::jsonb WHERE id = 78; -- Hawas Malibu -> Le Beau Le Parfum
UPDATE productos SET dupe_of = '{"name":"Le Beau Paradise Garden","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Le_Beau_Paradise_Garden.webp"}'::jsonb WHERE id = 79; -- Hawas Tropical -> Le Beau Paradise Garden
UPDATE productos SET dupe_of = '{"name":"Torino 21","brand":"Xerjoff","imageUrl":"/img PERFUMES/Torino_21.webp"}'::jsonb WHERE id = 80; -- Hawas Verde -> Torino 21
UPDATE productos SET dupe_of = '{"name":"Eden Juicy Apple","brand":"Kayali","imageUrl":"/img PERFUMES/Eden_Juicy_Apple.webp"}'::jsonb WHERE id = 82; -- Badee Al Oud Sublime -> Eden Juicy Apple
UPDATE productos SET dupe_of = '{"name":"Aventus","brand":"Creed","imageUrl":"/img PERFUMES/Aventus_Creed.png"}'::jsonb WHERE id = 83; -- Club de Nuit Intense -> Aventus
UPDATE productos SET dupe_of = '{"name":"Imagination","brand":"Louis Vuitton","imageUrl":"/img PERFUMES/Imagination_LV.webp"}'::jsonb WHERE id = 84; -- Game Of Spades Full House -> Imagination
UPDATE productos SET dupe_of = '{"name":"Le Beau","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Le_Beau_base.png"}'::jsonb WHERE id = 88; -- Odyssey Artisto -> Le Beau
UPDATE productos SET dupe_of = '{"name":"Scandal Pour Homme (versión concentrada)","brand":"Jean Paul Gaultier","imageUrl":"/img PERFUMES/Scandal_Pour_Homme.webp"}'::jsonb WHERE id = 89; -- Odyssey Mandarin Sky Elixir -> Scandal Pour Homme (versión concentrada)
UPDATE productos SET dupe_of = '{"name":"Eilish","brand":"Billie Eilish","imageUrl":"/img PERFUMES/Eilish.avif"}'::jsonb WHERE id = 94; -- Nebras -> Eilish
UPDATE productos SET dupe_of = '{"name":"La Vie Est Belle EDP","brand":"Lancôme","imageUrl":"/img PERFUMES/La_Vie_Est_Belle_EDP.webp"}'::jsonb WHERE id = 96; -- Yum Yum -> La Vie Est Belle EDP
UPDATE productos SET dupe_of = '{"name":"Acqua di Giò Profumo","brand":"Giorgio Armani","imageUrl":""}'::jsonb WHERE id = 100; -- Odyssey Nexus -> Acqua di Giò Profumo
UPDATE productos SET dupe_of = '{"name":"Dior Sauvage","brand":"Dior","imageUrl":"/img PERFUMES/Dior_Sauvage.png"}'::jsonb WHERE id = 102; -- Club de Nuit Urban Man Elixir -> Dior Sauvage
