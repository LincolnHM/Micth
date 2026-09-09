-- ─── MICHT Decants — Diagnóstico: ¿a quién le faltó el 2ml? (2026-09-08) ──────
--
-- El UPDATE anterior (2026-09-08c) debía dejar 92 perfumes con "2ml" en
-- `sizes`, pero solo quedaron 89 — faltan 3. Esta consulta dice exactamente
-- cuáles son y por qué: si "existe_en_supabase" sale en "NO", ese perfume
-- todavía no se ha sincronizado a la base de datos (es un perfume agregado
-- hace poco al catálogo); si sale "SI" pero sin 2ml, hay que revisar ese caso
-- aparte.
--
-- Solo hace falta correr esto y copiarme el resultado (la tabla que devuelve).

SELECT
  esperado.id,
  CASE WHEN p.id IS NULL THEN 'NO' ELSE 'SI' END AS existe_en_supabase,
  p.name,
  p.type,
  p.sizes
FROM (VALUES
  (0),(1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12),(13),(14),(81),(15),(16),(17),(18),(86),(95),(97),(99),(103),(104),(74),
  (19),(20),(21),(22),(23),(24),(25),(26),(27),(28),(29),(30),(31),(75),(32),(33),(34),(35),(76),(77),(78),(79),(80),(36),(37),(38),(39),(40),(41),(42),(43),(44),(45),(46),(87),(88),(89),(90),(91),(47),(48),(49),(50),(51),(52),(53),(54),(55),(56),(57),(58),(59),(82),(83),(84),(85),(92),(93),(94),(96),(98),(100),(101),(102),(73)
) AS esperado(id)
LEFT JOIN productos p ON p.id = esperado.id
WHERE p.id IS NULL OR NOT (p.sizes ? '2ml')
ORDER BY esperado.id;
