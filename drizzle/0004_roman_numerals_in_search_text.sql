-- Search text now writes Roman numerals as digits, like the queries: "smile iii" -> "smile 3".
UPDATE "recalls" SET "search_text" =
  regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace("search_text",
    '\mii\M', '2', 'g'), '\miii\M', '3', 'g'), '\miv\M', '4', 'g'), '\mvi\M', '6', 'g'),
    '\mvii\M', '7', 'g'), '\mviii\M', '8', 'g'), '\mix\M', '9', 'g')
WHERE "search_text" ~ '\m(ii|iii|iv|vi|vii|viii|ix)\M';
