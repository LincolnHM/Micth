-- ─── MICHT Decants — Notas corregidas de 25 perfumes (2026-11-28) ────────────
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run. Es seguro correrlo más de una vez.
--
-- POR QUÉ: las notas (salida, corazón y fondo) y la familia olfativa de estos perfumes
-- no coincidían con el perfume real (por ejemplo, Hawas Fire figuraba con «pimienta
-- roja» y es fresco y marino; Khamrah figuraba con rosa y oud y lleva dátiles y
-- praliné). Se revisaron con la marca, tiendas y bases de perfumes (Parfumo, Notino,
-- Fragplace, Scento…). Incluye los frascos enteros y sets del mismo perfume.
--
-- 1. NOTAS Y FAMILIA: se reemplazan en los perfumes de la lista (se buscan por nombre).
-- 2. DESCRIPCIÓN: solo se cambia si sigue IGUAL a la original del catálogo. Si ya la
--    editaste en el panel, no se toca (revísala tú: puede nombrar notas que no tiene).
--
-- No cambia precios, stock, fotos ni nada más.

-- ── 1. Notas y familia ─────────────────────────────────────────────────────
UPDATE productos SET olf_family = 'Oriental Gourmand', top_notes = 'Canela, Nuez moscada, Bergamota', heart_notes = 'Dátiles, Praliné, Nardo, Mahonial', base_notes = 'Vainilla, Haba tonka, Amberwood, Mirra, Benjuí, Akigalawood'
  WHERE lower(btrim(name)) = lower('Khamrah') OR lower(btrim(name)) = lower('Khamrah Clásico');
UPDATE productos SET olf_family = 'Gourmand Floral', top_notes = 'Caramelo, Leche, Azúcar', heart_notes = 'Miel, Flores blancas', base_notes = 'Vainilla, Praliné, Almizcle'
  WHERE lower(btrim(name)) = lower('Eclaire');
UPDATE productos SET olf_family = 'Frutal Floral', top_notes = 'Manzana, Lichi, Rosa', heart_notes = 'Ciruela, Jazmín', base_notes = 'Musgo, Vainilla, Pachulí'
  WHERE lower(btrim(name)) = lower('Badee Al Oud Sublime');
UPDATE productos SET olf_family = 'Frutal Gourmand', top_notes = 'Bergamota, Notas verdes', heart_notes = 'Melón, Piña, Ámbar, Acorde gourmand', base_notes = 'Almizcle, Vainilla, Maderas'
  WHERE lower(btrim(name)) = lower('Amber Oud Gold Edition');
UPDATE productos SET olf_family = 'Floral Frutal', top_notes = 'Ruibarbo, Lichi, Bergamota', heart_notes = 'Peonía, Rosa turca, Lirio', base_notes = 'Vainilla, Cashmeran, Almizcle blanco'
  WHERE lower(btrim(name)) = lower('Delilah');
UPDATE productos SET olf_family = 'Oriental Amaderado', top_notes = 'Manzana, Canela, Lavanda silvestre, Bergamota', heart_notes = 'Azahar, Lirio de los valles', base_notes = 'Vainilla, Haba tonka, Ámbar, Pachulí'
  WHERE lower(btrim(name)) = lower('9PM') OR lower(btrim(name)) = lower('Set de 9PM');
UPDATE productos SET olf_family = 'Ámbar Especiado', top_notes = 'Pitahaya, Bergamota, Coñac, Lavanda, Manzana', heart_notes = 'Cardamomo, Mahonial, Gamuza, Toffee, Cedro', base_notes = 'Haba tonka, Akigalawood, Ambrofix, Pachulí'
  WHERE lower(btrim(name)) = lower('9PM Night Out');
UPDATE productos SET olf_family = 'Oriental Especiado', top_notes = 'Cardamomo, Elemí, Nuez moscada', heart_notes = 'Pimienta de Jamaica, Lavanda, Cuero', base_notes = 'Láudano, Pachulí, Vainilla, Jara'
  WHERE lower(btrim(name)) = lower('9PM Elixir');
UPDATE productos SET olf_family = 'Frutal Amaderado', top_notes = 'Piña, Manzana verde, Mandarina', heart_notes = 'Musgo de roble, Cedro, Vainilla', base_notes = 'Maderas secas, Ámbar gris, Caramelo, Almizcle'
  WHERE lower(btrim(name)) = lower('9PM Rebel');
UPDATE productos SET olf_family = 'Cítrico Acuático', top_notes = 'Bergamota, Yuzu, Jengibre, Enebro', heart_notes = 'Pepino, Sal marina, Salvia, Iris', base_notes = 'Vainilla, Haba tonka, Almizcle, Ambrofix, Akigalawood'
  WHERE lower(btrim(name)) = lower('Khamrah Waha');
UPDATE productos SET olf_family = 'Ámbar Acuático', top_notes = 'Salvia esclarea', heart_notes = 'Jazmín, Notas marinas', base_notes = 'Ámbar, Ámbar gris'
  WHERE lower(btrim(name)) = lower('Hawas Fire');
UPDATE productos SET olf_family = 'Oriental Gourmand', top_notes = 'Bergamota, Pera, Canela', heart_notes = 'Azahar, Cardamomo, Pachulí', base_notes = 'Ámbar, Almizcle, Vainilla'
  WHERE lower(btrim(name)) = lower('Hawas Elixir');
UPDATE productos SET olf_family = 'Oriental Amaderado', top_notes = 'Bergamota, Jengibre, Naranja', heart_notes = 'Canela, Neroli, Té verde', base_notes = 'Almizcle, Maderas, Ámbar'
  WHERE lower(btrim(name)) = lower('Hawas Kobra');
UPDATE productos SET olf_family = 'Frutal Aromático', top_notes = 'Piña, Pomelo, Naranja', heart_notes = 'Ámbar, Iris, Lavanda', base_notes = 'Haba tonka, Pachulí, Almizcle, Cashmeran'
  WHERE lower(btrim(name)) = lower('Hawas Malibu');
UPDATE productos SET olf_family = 'Frutal Acuático', top_notes = 'Cítricos, Frutas tropicales, Bergamota', heart_notes = 'Notas acuáticas, Flores, Melón', base_notes = 'Almizcle, Maderas, Ámbar gris'
  WHERE lower(btrim(name)) = lower('Hawas Tropical');
UPDATE productos SET olf_family = 'Frutal Ambarado', top_notes = 'Durazno, Naranja dulce', heart_notes = 'Maracuyá, Mango, Geranio', base_notes = 'Cedro, Almizcle, Ámbar'
  WHERE lower(btrim(name)) = lower('Hawas Chrome');
UPDATE productos SET olf_family = 'Aromático Verde', top_notes = 'Lima, Manzana verde', heart_notes = 'Romero', base_notes = 'Pachulí, Ámbar'
  WHERE lower(btrim(name)) = lower('Hawas Verde');
UPDATE productos SET olf_family = 'Oriental Fougère', top_notes = 'Bergamota, Manzana, Naranja, Cardamomo', heart_notes = 'Geranio, Menta, Azahar, Praliné', base_notes = 'Ámbar gris, Haba tonka, Ámbar, Musgo'
  WHERE lower(btrim(name)) = lower('Nitro Elixir');
UPDATE productos SET olf_family = 'Oriental Especiado', top_notes = 'Bergamota, Limón, Pimienta negra', heart_notes = 'Canela, Nuez moscada, Cardamomo, Lavanda', base_notes = 'Ámbar, Sándalo, Almizcle, Vainilla'
  WHERE lower(btrim(name)) = lower('Nitro Gold');
UPDATE productos SET olf_family = 'Oriental Amaderado', top_notes = 'Bergamota, Grosella negra, Mandarina verde', heart_notes = 'Jazmín, Lavanda, Pimienta rosa, Especias', base_notes = 'Ámbar, Almizcle, Vetiver, Maderas'
  WHERE lower(btrim(name)) = lower('Sceptre Malachite') OR lower(btrim(name)) = lower('Spectre Malacrite');
UPDATE productos SET olf_family = 'Cítrico Frutal', top_notes = 'Bergamota, Naranja, Limón', heart_notes = 'Notas frutales', base_notes = 'Vainilla, Almizcle blanco, Ámbar'
  WHERE lower(btrim(name)) = lower('Bharara King');
UPDATE productos SET olf_family = 'Amaderado Aromático', top_notes = 'Pimienta, Limón, Naranja, Bergamota, Pomelo, Piña', heart_notes = 'Lavanda, Geranio, Ylang-ylang, Caramelo', base_notes = 'Pachulí, Vetiver, Cedro, Almizcle, Cuero, Ámbar'
  WHERE lower(btrim(name)) = lower('Eter Arabian Sky');
UPDATE productos SET olf_family = 'Amaderado Ambarado', top_notes = 'Especias, Bergamota, Mandarina', heart_notes = 'Lavandín', base_notes = 'Vetiver, Guayaco, Maderas ambaradas, Vainilla'
  WHERE lower(btrim(name)) = lower('Valentino Extradose');
UPDATE productos SET olf_family = 'Oriental Especiado', top_notes = 'Mandarina, Canela', heart_notes = 'Sirope de arce, Ron', base_notes = 'Ámbar, Pachulí, Vainilla'
  WHERE lower(btrim(name)) = lower('1 Million Night Elixir');
UPDATE productos SET olf_family = 'Floral Ambarado', top_notes = 'Azahar, Bergamota, Pomelo', heart_notes = 'Jazmín indio, Nardo', base_notes = 'Vainilla de Madagascar, Pachulí, Ámbar, Almizcle blanco'
  WHERE lower(btrim(name)) = lower('Stallion Donna Intense') OR lower(btrim(name)) = lower('Stallion Donna Intense Entero');

-- ── 2. Descripciones (solo si no las cambiaste en el panel) ────────────────
UPDATE productos SET description = 'Bharara King: cítricos brillantes y frutas dulces sobre vainilla, almizcle y ámbar. Regio, potente y con mucha presencia.'
  WHERE id = 19 AND description = 'Bharara King: fragancia unisex regia y opulenta. Oud y madera de cedro sobre cítricos brillantes. Para quienes exigen lo mejor.';
UPDATE productos SET description = 'Sceptre Malachite: frutal y luminoso, con grosella negra y mandarina verde sobre ámbar y vetiver. Alternativa accesible a God of Fire.'
  WHERE id = 20 AND description = 'Sceptre Malachite: frescura aristocrática con notas acuáticas y especias verdes. Elegante alternativa a fragancias de lujo.';
UPDATE productos SET description = 'Amber Oud Gold: frutas dulces como melón y piña sobre almizcle, vainilla y maderas. Potente, alegre y muy duradero.'
  WHERE id = 21 AND description = 'Amber Oud Gold: la esencia del lujo árabe. Azafrán y oud con ámbar dorado. Imponente y sofisticado.';
UPDATE productos SET description = '9PM: el clon árabe de Ultra Male. Manzana, canela y lavanda sobre vainilla y haba tonka. Perfección nocturna a precio accesible.'
  WHERE id = 23 AND description = '9PM: el clon árabe de Stronger With You. Manzana y castaña sobre vainilla cálida. Perfección nocturna a precio accesible.';
UPDATE productos SET description = '9PM Night Out: dulce y nocturno, con pitahaya, coñac y toffee sobre haba tonka y maderas. La esencia de la noche.'
  WHERE id = 24 AND description = '9PM Night Out: versión más oscura y especiada. Pimienta negra y cardamomo con oud y ámbar. La esencia de la noche.';
UPDATE productos SET description = '9PM Elixir: la versión más intensa de la serie. Cardamomo y nuez moscada con cuero sobre láudano y vainilla. Adictivo.'
  WHERE id = 26 AND description = '9PM Elixir: la versión más intensa de la serie. Especias oscuras y oud con elixir de ámbar y vainilla. Adictivo.';
UPDATE productos SET description = '9PM Rebel: espíritu rebelde con piña confitada y manzana verde sobre vainilla y caramelo. Frutal y juvenil. Próximamente disponible.'
  WHERE id = 27 AND description = '9PM Rebel: espíritu rebelde con jengibre y cuero ahumado. Amaderado e incandescente. Próximamente disponible.';
UPDATE productos SET description = 'Khamrah: el clásico oriental de Lattafa. Canela y dátiles con praliné sobre vainilla y haba tonka. Un viaje sensorial al corazón de Arabia.'
  WHERE id = 31 AND description = 'Khamrah: el clásico oriental de Lattafa. Manzana y canela sobre rosa y oud. Un viaje sensorial al corazón de Arabia.';
UPDATE productos SET description = 'Khamrah Waha: la versión fresca de la icónica línea Khamrah de Lattafa. "Waha" significa oasis: yuzu, jengibre, pepino y sal marina sobre un fondo suave de vainilla y almizcle. Ideal para el día.'
  WHERE id = 75 AND description = 'Khamrah Waha: la versión fresca y frutal de la icónica línea Khamrah de Lattafa. "Waha" significa oasis — un refugio fragante con frutas jugosas y flores delicadas sobre una base oriental suave. Ideal para el día.';
UPDATE productos SET description = 'Hawas Fire: pese a su nombre, sorprende fresco. Salvia y jazmín con notas marinas sobre ámbar. Versátil e irresistible.'
  WHERE id = 32 AND description = 'Hawas Fire: la pasión ardiente del oriente. Pimienta roja y cardamomo sobre vetiver ahumado. Intenso, fogoso e irresistible.';
UPDATE productos SET description = 'Hawas Elixir: la versión más dulce de la línea Hawas. Pera y canela con azahar sobre ámbar y vainilla. Actualmente agotado.'
  WHERE id = 33 AND description = 'Hawas Elixir: la esencia más profunda de la línea Hawas. Oud y sándalo con ámbar oscuro. Actualmente agotado.';
UPDATE productos SET description = 'Hawas Kobra: jengibre y naranja abren paso a canela, neroli y té verde, sobre ámbar, almizcle y maderas. Elegante, especiado e hipnótico.'
  WHERE id = 76 AND description = 'Hawas Kobra: la joya más oscura y venenosa de la línea Hawas. Cardamomo y pimienta negra abren paso a un corazón de oud y vetiver ahumado, sellado por ámbar oscuro y sándalo. Intenso, misterioso e hipnótico.';
UPDATE productos SET description = 'Hawas Chrome: frutal tropical con durazno, maracuyá y mango sobre ámbar y cedro. Próximamente en MICHT.'
  WHERE id = 77 AND description = 'Hawas Chrome: la elegancia metálica de la serie Hawas. Fresco y sofisticado con un corazón aromático sobre base amaderada. Próximamente en MICHT.';
UPDATE productos SET description = 'Hawas Malibu: el paraíso tropical en un frasco. Piña y cítricos con lavanda sobre un fondo cremoso de haba tonka. Próximamente en MICHT.'
  WHERE id = 78 AND description = 'Hawas Malibu: el paraíso tropical en un frasco. Coco y piña sobre flores de tiaré y un fondo de almizcle cálido. Próximamente en MICHT.';
UPDATE productos SET description = 'Hawas Verde: frescura verde con lima y manzana verde sobre romero, pachulí y ámbar. Próximamente en MICHT.'
  WHERE id = 80 AND description = 'Hawas Verde: la naturaleza salvaje capturada en un frasco. Menta y hojas verdes sobre lavanda y vetiver limpio. Próximamente en MICHT.';
UPDATE productos SET description = 'Nitro Elixir: el más intenso de la serie Nitro. Manzana y cardamomo con praliné sobre haba tonka y ámbar. Próximamente en MICHT.'
  WHERE id = 37 AND description = 'Nitro Elixir: el más intenso de la serie Nitro. Oud e incienso sobre ámbar líquido. Próximamente en MICHT.';
UPDATE productos SET description = 'Nitro Gold: elegancia dorada con pimientas y especias cálidas sobre ámbar, sándalo y vainilla. Opulento y distinguido.'
  WHERE id = 38 AND description = 'Nitro Gold: elegancia dorada con sándalo y ámbar. Opulento y distinguido.';
UPDATE productos SET description = 'Eter Arabian Sky: cítricos y piña con lavanda que se vuelven dulces con caramelo, sobre pachulí, cuero y ámbar. Próximamente.'
  WHERE id = 47 AND description = 'Eter Arabian Sky: el cielo árabe en una fragancia. Rosa y azafrán sobre oud y sándalo dorado. Próximamente.';
UPDATE productos SET description = 'Eclaire: caramelo, leche y miel sobre vainilla y praliné. Un gourmand cremoso, delicado y tentador.'
  WHERE id = 51 AND description = 'Eclaire: flores suaves y frutas rojas sobre un fondo cálido de vainilla. Delicado y tentador.';
UPDATE productos SET description = 'Stallion Donna Intense: feminidad apasionada con jazmín y nardo sobre vainilla y ámbar. Sensual e intenso.'
  WHERE id = 53 AND description = 'Stallion Donna Intense: feminidad apasionada con rosa turca y durazno sobre ámbar. Sensual e intenso.';
UPDATE productos SET description = 'Delilah: rosa con lichi y ruibarbo sobre vainilla y almizcle blanco. Femenino y delicado. Actualmente agotado.'
  WHERE id = 59 AND description = 'Delilah: suavidad floral con rosa y jazmín sobre almizcle y vainilla. Femenino y delicado. Actualmente agotado.';
UPDATE productos SET description = 'Badee Al Oud Sublime: manzana roja, lichi y rosa sobre ciruela, jazmín y un fondo de musgo y vainilla. Frutal y adictivo. Próximamente en MICHT.'
  WHERE id = 82 AND description = 'Badee Al Oud Sublime: la sublimidad del oud árabe en toda su gloria. Azafrán y rosa sobre un corazón de oud profundo con base de ámbar y sándalo. Próximamente en MICHT.';
UPDATE productos SET description = 'Valentino Extradose: una dosis concentrada de la elegancia Born in Roma. Especias y lavandín sobre vetiver, guayaco y vainilla. Intenso y elegante.'
  WHERE id = 95 AND description = 'Valentino Extradose: una dosis concentrada de la elegancia Born in Roma. Bergamota y pimienta rosa sobre un fondo amaderado de cedro y ámbar. Fresco e intenso a la vez.';
UPDATE productos SET description = '1 Million Night Elixir: la versión más intensa y nocturna del icónico 1 Million. Mandarina y canela con sirope de arce y ron sobre ámbar y vainilla, para una noche de poder absoluto.'
  WHERE id = 99 AND description = '1 Million Night Elixir: la versión más intensa y nocturna del icónico 1 Million. Especias cálidas y cuero envuelven un fondo ambarino dorado, para una noche de poder absoluto.';
UPDATE productos SET description = 'Frasco completo de 9PM Afnan. El clásico oriental nocturno inspirado en Ultra Male.'
  WHERE id = 62 AND description = 'Frasco completo de 9PM Afnan. El clásico oriental nocturno inspirado en Stronger With You.';
UPDATE productos SET description = 'Frasco completo de Spectre Malacrite. Frutal y luminoso, con grosella negra y mandarina verde sobre ámbar.'
  WHERE id = 71 AND description = 'Frasco completo de Spectre Malacrite Armaf. Frescura aromática con especias verdes y madera noble.';
UPDATE productos SET description = 'Frasco completo de Stallion Donna Intense. Feminidad apasionada con jazmín y nardo sobre vainilla y ámbar.'
  WHERE id = 72 AND description = 'Frasco completo de Stallion Donna Intense. Feminidad apasionada con rosa turca sobre ámbar.';

-- Comprobación: estos perfumes deben mostrar las notas nuevas
SELECT id, name, olf_family, top_notes, heart_notes, base_notes
FROM productos
WHERE lower(btrim(name)) IN (lower('Khamrah'), lower('Khamrah Clásico'), lower('Eclaire'), lower('Badee Al Oud Sublime'), lower('Amber Oud Gold Edition'), lower('Delilah'), lower('9PM'), lower('Set de 9PM'), lower('9PM Night Out'), lower('9PM Elixir'), lower('9PM Rebel'), lower('Khamrah Waha'), lower('Hawas Fire'), lower('Hawas Elixir'), lower('Hawas Kobra'), lower('Hawas Malibu'), lower('Hawas Tropical'), lower('Hawas Chrome'), lower('Hawas Verde'), lower('Nitro Elixir'), lower('Nitro Gold'), lower('Sceptre Malachite'), lower('Spectre Malacrite'), lower('Bharara King'), lower('Eter Arabian Sky'), lower('Valentino Extradose'), lower('1 Million Night Elixir'), lower('Stallion Donna Intense'), lower('Stallion Donna Intense Entero'))
ORDER BY name, id;
