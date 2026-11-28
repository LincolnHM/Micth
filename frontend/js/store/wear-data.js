// ─── «Cuándo usarlo»: análisis de cada perfume del catálogo ──────────────────
// Hecho a mano, perfume por perfume, con sus notas reales, su estilo y, en los
// dupes, el perfume famoso al que se parece. Para los menos conocidos se
// revisaron las notas publicadas por tiendas y bases de perfumes (noviembre
// 2026). Un perfume que no esté aquí usa el cálculo automático de
// wear-profile.js (según sus acordes).
//
// Formato de cada perfume:
//   'nombre normalizado': [
//     [invierno, primavera, verano, otoño],   0–100
//     [día, noche],                           0–100
//     ['usos'],                               claves de WEAR_USES
//     "Para qué va (una o dos frases)"
//   ]
// El nombre se normaliza con wearKey(): minúsculas, sin tildes ni signos, y sin
// «entero», «set de» ni «gift set» (así el frasco entero usa los mismos datos).

const WEAR_USES = {
  diario:  'Día a día',
  oficina: 'Oficina y clases',
  salidas: 'Salidas',
  citas:   'Citas',
  fiestas: 'Fiestas',
  eventos: 'Eventos formales',
  deporte: 'Deporte',
  playa:   'Playa y calor',
  frio:    'Clima frío'
};

// Nombres distintos del mismo perfume (frascos enteros, sets, errores de tipeo)
const WEAR_ALIASES = {
  'khamrah clasico':      'khamrah',
  'odyssey mandarin sky': 'mandarin sky',
  'spectre malacrite':    'sceptre malachite',
  'armaf tag him':        'tag',
  'tag him':              'tag',
  'born in roma':         'valentino uomo born in roma',
  'valentino born in roma extradose': 'valentino extradose'
};

const WEAR_DATA = {
  // ── Diseñador y nicho ──────────────────────────────────────────────────────
  'l immensite':                 [[35, 90, 100, 60],  [100, 55], ['oficina', 'diario', 'playa'],   "Toronja y jengibre sobre ambroxan: fresco, limpio y muy seguro. Ideal para el calor y el día: oficina, clases o salir de día."],
  'creed aventus':               [[55, 100, 90, 75],  [100, 75], ['oficina', 'citas', 'eventos'], "Piña ahumada con abedul y musgo: el clásico del éxito. Va casi todo el año, sobre todo de día, y queda igual de bien en la oficina que en una cita o un evento."],
  'erba pura':                   [[55, 100, 90, 80],  [100, 85], ['salidas', 'citas', 'fiestas'], "Frutas cítricas jugosas sobre almizcle y vainilla, con muchísima presencia. Va casi todo el año menos con frío fuerte; ideal para salir y llamar la atención. Con 2 sprays basta."],
  'le beau le parfum':           [[30, 90, 100, 55],  [75, 100], ['salidas', 'citas', 'playa'],   "Coco y piña cremosos con haba tonka: verano puro con un toque seductor. Perfecto para tardes y noches de calor, salidas y citas."],
  'le male elixir':              [[100, 40, 10, 90],  [30, 100], ['citas', 'fiestas', 'frio'],    "Miel, tabaco y vainilla muy intensos. Un perfume de noche y de frío para citas y fiestas; con calor empalaga, así que 1 o 2 sprays."],
  'le male le parfum':           [[100, 60, 20, 95],  [55, 100], ['citas', 'eventos', 'frio'],    "Lavanda, iris y vainilla con cardamomo: elegante y envolvente. Ideal en otoño e invierno, de noche o en eventos; también va en tardes frescas."],
  'valentino intense':           [[100, 60, 15, 95],  [55, 100], ['eventos', 'citas', 'frio'],    "Iris empolvado con vainilla y cuero suave: refinado y muy elegante. Para eventos formales y citas con clima fresco o de noche."],
  'the most wanted':             [[100, 40, 10, 90],  [30, 100], ['fiestas', 'citas', 'frio'],    "Cardamomo, toffee y maderas ambaradas: dulce, especiado y muy llamativo. Un perfume de noche para fiestas y citas en clima fresco."],
  'stronger with you intensely': [[100, 55, 10, 95],  [45, 100], ['citas', 'salidas', 'frio'],    "Castaña, vainilla y canela: dulce, cálido y muy fácil de llevar. Ideal para noches frescas, citas y salidas en otoño e invierno."],
  'bleu de chanel parfum':       [[80, 100, 75, 100], [100, 80], ['oficina', 'eventos', 'diario'], "Cítricos, incienso y sándalo cremoso: elegante y versátil. De los más seguros para todo el año: oficina, reuniones y eventos."],
  'y edp':                       [[70, 100, 70, 95],  [100, 70], ['oficina', 'diario', 'salidas'], "Manzana, jengibre y salvia sobre ambroxan: fresco-dulce y moderno. Muy versátil de día, sobre todo en primavera y otoño: oficina y salidas."],
  'homme intense':               [[100, 70, 20, 95],  [55, 100], ['eventos', 'citas', 'frio'],    "Iris empolvado con un fondo suave de cacao y vetiver: sofisticado y muy elegante. Ideal para eventos, citas y clima frío."],
  'dior sauvage':                [[70, 100, 95, 85],  [100, 75], ['diario', 'oficina', 'salidas'], "Bergamota picante y ambroxan: fresco, potente y reconocible. Funciona todo el año, sobre todo de día; un comodín para diario, oficina o salir."],
  'eros flame':                  [[100, 70, 30, 95],  [60, 100], ['citas', 'fiestas', 'salidas'], "Cítricos y pimienta sobre vainilla y haba tonka: dulce, especiado y con energía. Ideal con clima fresco y de noche: citas y fiestas."],
  'invictus parfum':             [[60, 100, 80, 90],  [80, 100], ['salidas', 'fiestas', 'diario'], "Pomelo y laurel con un fondo marino y amaderado: fresco pero con cuerpo. Versátil casi todo el año; brilla en salidas y fiestas."],
  'invictus victory elixir':     [[100, 45, 10, 90],  [30, 100], ['fiestas', 'citas', 'frio'],    "Vainilla, incienso y haba tonka muy intensos. Hecho para la noche y el frío: fiestas y citas. Uno o dos sprays duran todo el día."],
  'rose n roses':                [[45, 100, 85, 60],  [100, 50], ['diario', 'oficina', 'salidas'], "Rosas frescas y luminosas con un fondo limpio. Ideal para el día en primavera y verano: oficina, clases y salidas."],
  'q':                           [[45, 100, 80, 70],  [100, 60], ['diario', 'salidas', 'oficina'], "Cereza y limón con jazmín y cedro: frutal y femenino. Perfecto de día en primavera y verano, para el día a día y salir."],
  'miss dior blooming bouquet':  [[35, 100, 90, 55],  [100, 40], ['diario', 'oficina', 'salidas'], "Peonía y rosa delicadas, limpias y frescas. Un floral suave para el día en primavera y verano; ideal para la oficina y el día a día."],
  'n 5':                         [[95, 85, 40, 100],  [60, 100], ['eventos', 'citas'],            "Aldehídos, flores y sándalo: el clásico elegante por excelencia. Brilla en clima fresco, en eventos formales y de noche."],
  'valentino extradose':         [[100, 70, 25, 100], [55, 100], ['citas', 'eventos', 'frio'],    "Lavanda, especias y vetiver sobre maderas ambaradas: masculino, intenso y elegante. Ideal en otoño e invierno, sobre todo de noche."],
  'scandal le parfum':           [[100, 55, 15, 95],  [40, 100], ['citas', 'fiestas', 'eventos'], "Miel, caramelo y flores blancas sobre pachulí: dulce, intenso y seductor. Para noches frescas, citas y fiestas."],
  '1 million night elixir':      [[100, 40, 10, 90],  [30, 100], ['fiestas', 'citas', 'frio'],    "Ámbar con mandarina, sirope de arce y ron: dulce, licoroso y muy nocturno. Ideal para fiestas y citas con frío."],
  '212 vip black elixir':        [[100, 50, 15, 90],  [30, 100], ['fiestas', 'citas', 'frio'],    "Lavanda y regaliz negro sobre vainilla: oscuro, dulce y fiestero. Hecho para la noche y el frío."],
  'forever wanted elixir':       [[100, 55, 15, 95],  [35, 100], ['citas', 'fiestas', 'frio'],    "Frutal y especiado con cuero y maderas sobre un fondo cálido: intenso y seductor. Ideal para noches frescas, citas y fiestas."],
  'sauvage elixir':              [[100, 45, 10, 95],  [35, 100], ['eventos', 'citas', 'frio'],    "Canela, nuez moscada, lavanda y regaliz sobre ámbar amaderado: especiado, profundo y potente. Para noches frías, citas y eventos; 1 o 2 sprays."],
  'acqua di gio profondo':       [[20, 85, 100, 55],  [100, 55], ['playa', 'diario', 'oficina'],  "Marino profundo con mandarina verde, romero y almizcle: fresco y limpio. Hecho para el calor y el día: oficina, playa y día a día."],
  'valentino uomo born in roma': [[85, 95, 55, 100],  [80, 100], ['citas', 'salidas', 'oficina'], "Hoja de violeta, salvia y vainilla ahumada con vetiver: moderno, mineral y elegante. Muy versátil; brilla en clima templado, de tarde y de noche."],

  // ── Árabes ─────────────────────────────────────────────────────────────────
  'bharara king':                [[70, 100, 75, 90],  [85, 100], ['salidas', 'fiestas', 'citas'], "Cítricos y frutas dulces sobre vainilla, almizcle y ámbar, con mucha presencia. Versátil casi todo el año; brilla en salidas y fiestas. Con pocos sprays basta."],
  'sceptre malachite':           [[40, 100, 95, 70],  [100, 65], ['diario', 'salidas', 'oficina'], "Frutal tipo mango con grosella y mandarina verde sobre ámbar, inspirado en God of Fire. Ideal de día en clima cálido o templado: diario y salidas."],
  'amber oud gold edition':      [[55, 100, 90, 80],  [90, 100], ['salidas', 'fiestas', 'citas'], "Frutas dulces y cítricas sobre almizcle y ámbar, muy parecido a Erba Pura: potente y de larga duración. Va casi todo el año; ideal para salir. Pocos sprays."],
  'liquid brun':                 [[100, 50, 10, 95],  [35, 100], ['citas', 'fiestas', 'frio'],    "Vainilla, canela y praliné, cálido y goloso, inspirado en Althaïr. Para el frío y la noche: citas y salidas. Con calor fuerte puede empalagar."],
  '9pm':                         [[100, 60, 20, 90],  [35, 100], ['fiestas', 'citas', 'salidas'], "Manzana, canela y vainilla, dulce y muy llamativo (estilo Ultra Male). El rey de las noches de fiesta y las citas, sobre todo con clima fresco."],
  '9pm night out':               [[95, 55, 20, 100],  [30, 100], ['fiestas', 'citas', 'salidas'], "Pitahaya y coñac con toffee, gamuza y haba tonka: dulce, cálido y nocturno, como su nombre. Ideal para salir de noche en otoño e invierno."],
  '9pm elixir':                  [[100, 45, 10, 95],  [30, 100], ['citas', 'fiestas', 'frio'],    "Cardamomo y nuez moscada con cuero, sobre labdano y vainilla: una versión más oscura e intensa del 9PM. Para noches frías, citas y fiestas."],
  '9pm rebel':                   [[55, 100, 95, 75],  [85, 100], ['salidas', 'fiestas', 'citas'], "Piña confitada y manzana verde sobre vainilla y caramelo: frutal, dulce y juvenil. Ideal con clima cálido o templado, sobre todo en salidas y fiestas."],
  '9pm pour femme':              [[80, 100, 55, 90],  [70, 100], ['citas', 'salidas', 'fiestas'], "Frutos rojos con jazmín, rosa y peonía sobre vainilla: femenino y seductor. Ideal para salidas y citas, de tarde o de noche."],
  '9am':                         [[35, 100, 95, 65],  [100, 55], ['oficina', 'diario', 'deporte'], "Cítricos con lavanda y albahaca sobre cedro y almizcle: fresco, limpio y energizante. Ideal de día en primavera y verano."],
  '9am dive':                    [[30, 95, 100, 60],  [100, 55], ['diario', 'deporte', 'playa'],  "Fresco, acuático y frutal con menta: limpio y energizante. Perfecto para el calor, el día a día y después de hacer deporte."],
  '9am pour femme':              [[40, 100, 90, 60],  [100, 55], ['diario', 'oficina', 'salidas'], "Cítricos con rosa y peonía sobre almizcle blanco: fresco, limpio y femenino. Ideal de día en primavera y verano."],
  'his confession':              [[100, 55, 15, 95],  [35, 100], ['citas', 'eventos', 'frio'],    "Canela, lavanda y vainilla con un toque de iris: cálido, elegante y envolvente. Ideal para noches frescas, citas y eventos."],
  'khamrah':                     [[100, 50, 10, 95],  [35, 100], ['citas', 'fiestas', 'frio'],    "Dátiles, canela y praliné sobre vainilla: dulce, especiado y muy llamativo (inspirado en Angels’ Share). Un perfume de noche para el frío, citas y fiestas."],
  'khamrah qahwa':               [[100, 45, 10, 95],  [50, 100], ['citas', 'salidas', 'frio'],    "Café árabe, cardamomo y praliné: goloso y acogedor. Para el frío y las tardes o noches: citas y salidas. Con calor fuerte, pocos sprays."],
  'khamrah dukhan':              [[100, 35, 5, 90],   [20, 100], ['eventos', 'citas', 'frio'],    "Especias, tabaco e incienso ahumado sobre ámbar: profundo y misterioso. Para noches frías y ocasiones especiales."],
  'khamrah waha':                [[35, 100, 100, 65], [100, 65], ['diario', 'oficina', 'playa'],  "El Khamrah fresco: yuzu, jengibre, pepino y sal marina sobre un fondo suave de vainilla y almizcle. Ideal para el calor y el día: oficina, clases y salidas."],
  'hawas fire':                  [[45, 95, 100, 70],  [85, 100], ['salidas', 'fiestas', 'diario'], "Pese a su nombre, es fresco: salvia, jazmín y notas marinas sobre ámbar. Va bien con clima cálido o templado, de día o de noche; ideal para salir."],
  'hawas elixir':                [[100, 55, 15, 90],  [40, 100], ['citas', 'fiestas', 'frio'],    "La versión dulce de la familia Hawas: pera y canela sobre vainilla y ámbar. Mejor con clima fresco y de noche: citas y fiestas."],
  'hawas ice':                   [[20, 90, 100, 50],  [100, 60], ['playa', 'deporte', 'diario'],  "Menta helada, frutas y notas acuáticas: súper fresco y potente. Hecho para el calor, la playa y el día; también para noches calurosas."],
  'hawas for him':               [[30, 90, 100, 60],  [90, 100], ['salidas', 'fiestas', 'playa'], "Frutal-acuático con manzana, ciruela y ambergris: fresco, dulce y con muchísima proyección (estilo Invictus Aqua). Ideal para el calor y las noches de fiesta."],
  'hawas kobra':                 [[70, 100, 70, 95],  [85, 100], ['salidas', 'citas', 'oficina'], "Jengibre, naranja y canela con neroli y té verde sobre ámbar: fresco-especiado y elegante. Versátil casi todo el año; luce más al atardecer y de noche."],
  'hawas chrome':                [[45, 100, 95, 70],  [100, 90], ['salidas', 'fiestas', 'playa'], "Durazno, maracuyá y mango sobre ámbar: frutal tropical con aire a Erba Pura. Ideal con clima cálido, de día o de noche, para salir."],
  'hawas malibu':                [[35, 95, 100, 65],  [90, 100], ['playa', 'salidas', 'fiestas'], "Piña y cítricos con lavanda y un fondo cremoso de haba tonka: costero y tropical. Perfecto para el verano, la playa y las noches de calor."],
  'hawas tropical':              [[25, 95, 100, 55],  [100, 70], ['playa', 'diario', 'deporte'],  "Cítricos, frutas tropicales y melón acuático: fresco y jugoso. Ideal para el día con calor: playa, deporte y día a día."],
  'hawas verde':                 [[35, 100, 95, 70],  [100, 55], ['diario', 'oficina', 'deporte'], "Lima y manzana verde con romero: fresco, verde y limpio. Ideal de día en primavera y verano: oficina, clases y deporte."],
  'hawas gold digger':           [[90, 90, 45, 100],  [75, 100], ['citas', 'salidas', 'oficina'], "Pera y menta frescas que terminan en canela y vainilla cremosa: fresco al inicio y cálido al final. Va bien con clima templado o fresco, de tarde y de noche."],
  'nitro red':                   [[70, 90, 65, 95],   [65, 100], ['salidas', 'fiestas', 'citas'], "Especiado y frutal con un fondo amaderado y ambarado: enérgico y llamativo. Ideal para salir de noche, sobre todo con clima templado o fresco."],
  'nitro red intensely':         [[85, 75, 40, 100],  [45, 100], ['fiestas', 'citas', 'frio'],    "La versión más intensa de Nitro Red: especias, oud y cuero sobre ámbar. Para noches de fiesta y clima fresco."],
  'nitro elixir':                [[90, 80, 40, 100],  [60, 100], ['citas', 'salidas', 'fiestas'], "Manzana y cardamomo con praliné, haba tonka y ámbar: dulce, fresco al inicio y muy envolvente. Ideal para tardes y noches de clima templado o fresco."],
  'nitro gold':                  [[80, 90, 60, 100],  [80, 100], ['salidas', 'fiestas', 'citas'], "Pimientas y cítricos con un fondo cálido de ámbar y vainilla: llamativo y versátil. Funciona bien con clima templado, de tarde y de noche."],
  'asad elixir':                 [[100, 45, 10, 95],  [35, 100], ['citas', 'fiestas', 'frio'],    "Canela, nuez moscada y lavanda sobre ámbar amaderado, al estilo Sauvage Elixir: especiado y potente. Para noches frías, citas y fiestas."],
  'asad bourbon':                [[100, 40, 10, 95],  [30, 100], ['citas', 'fiestas', 'frio'],    "Bourbon, especias y vainilla con cuero: dulce, licoroso y nocturno. Ideal en invierno y otoño para citas y fiestas."],
  'mandarin sky':                [[90, 95, 55, 100],  [85, 100], ['salidas', 'citas', 'diario'],  "Mandarina con caramelo y haba tonka: dulce, fresco y muy fácil de llevar (estilo Scandal Pour Homme). Versátil casi todo el año, de día o de noche."],
  'odyssey mandarin sky elixir': [[100, 65, 25, 100], [45, 100], ['citas', 'fiestas', 'frio'],    "La versión más intensa de Mandarin Sky: mandarina con ámbar y caramelo más profundos. Para noches frescas, citas y fiestas."],
  'odyssey mega':                [[60, 100, 85, 85],  [100, 70], ['oficina', 'diario', 'salidas'], "Fresco y moderno con cítricos, grosella y lavanda sobre cedro (estilo Y EDP). Muy versátil de día: oficina, clases y salidas."],
  'odyssey aqua':                [[25, 90, 100, 55],  [100, 60], ['playa', 'deporte', 'diario'],  "Acuático y cítrico con lima y notas marinas: fresco y limpio. Perfecto para el calor, el día a día y el deporte."],
  'odyssey white':               [[100, 60, 20, 95],  [55, 100], ['citas', 'salidas', 'frio'],    "Cálido y suave con especias y vainilla, al estilo Stronger With You. Ideal con clima fresco, para citas y salidas de tarde o noche."],
  'odyssey limoni':              [[15, 90, 100, 50],  [100, 45], ['playa', 'diario', 'oficina'],  "Limón siciliano y mandarina, jugoso y muy refrescante (estilo Afternoon Swim). Hecho para el sol: días de calor, playa y oficina."],
  'odyssey mango':               [[25, 90, 100, 55],  [100, 60], ['playa', 'salidas', 'diario'],  "Mango tropical jugoso con durazno: dulce, alegre y veraniego. Ideal para el día con calor y salidas casuales."],
  'odyssey bahamas':             [[20, 85, 100, 45],  [100, 60], ['playa', 'salidas', 'diario'],  "Piña y coco con flor de tiaré: vacaciones en un frasco. Perfecto para la playa, el calor y los días de sol."],
  'odyssey artisto':             [[55, 95, 100, 75],  [80, 100], ['salidas', 'citas', 'playa'],   "Coco y vainilla cremosos con un toque especiado, al estilo Le Beau: dulce y veraniego. Ideal para tardes y noches de calor, citas y salidas."],
  'odyssey candee':              [[80, 100, 55, 85],  [85, 100], ['salidas', 'citas', 'diario'],  "Fresas y frutos rojos dulces sobre vainilla y almizcle (estilo Burberry Her): divertido y juvenil. Ideal en primavera y otoño, de día o de noche."],
  'odyssey nexus':               [[55, 100, 95, 80],  [100, 75], ['oficina', 'eventos', 'diario'], "Marino y aromático con un fondo de incienso suave, al estilo Acqua di Giò Profumo: fresco pero elegante. Muy versátil de día; también para eventos."],
  'odyssey homme':               [[100, 55, 15, 95],  [40, 100], ['citas', 'eventos', 'frio'],    "Cardamomo, nuez moscada y vainilla cremosa sobre ámbar, al estilo Tom Ford Noir Extreme: cálido y elegante. Para clima fresco, citas y eventos."],
  'club de nuit intense':        [[50, 100, 90, 75],  [100, 75], ['oficina', 'salidas', 'eventos'], "Piña, limón y abedul ahumado, inspirado en Creed Aventus: fresco, potente y elegante. Ideal de día con clima templado o cálido; con 2 sprays sobra."],
  'club de nuit urban man elixir': [[75, 100, 85, 90], [100, 85], ['diario', 'oficina', 'salidas'], "Bergamota y pimienta con lavanda sobre ámbar, al estilo Dior Sauvage: fresco-especiado y potente. Un comodín para casi todo el año."],
  'supremacy collector s edition': [[55, 100, 90, 75], [100, 75], ['oficina', 'salidas', 'eventos'], "Piña, manzana y abedul sobre ámbar gris y musgo, al estilo Creed Aventus: fresco, elegante y potente. Ideal de día casi todo el año."],
  'king of kings chapter 1':     [[70, 95, 80, 90],   [80, 100], ['salidas', 'fiestas', 'citas'], "Frutal y dulce con manzana especiada sobre ámbar y vainilla. Versátil con clima templado; ideal para salidas y fiestas."],
  'king of kings nebula':        [[100, 40, 10, 95],  [25, 100], ['eventos', 'citas', 'frio'],    "Incienso y oud ahumados sobre ámbar: oscuro y elegante. Para noches frías y ocasiones especiales."],
  'king of kings royal amber':   [[85, 90, 60, 100],  [75, 100], ['salidas', 'citas', 'fiestas'], "Frutas frescas (mango, melón, pera) con especias sobre ámbar y vainilla: jugoso y cálido a la vez. Versátil; brilla en tardes y noches templadas."],
  'eter arabian sky':            [[70, 100, 80, 90],  [100, 85], ['diario', 'oficina', 'salidas'], "Cítricos y piña con lavanda que se vuelven dulces con caramelo y ámbar: fresco al inicio y cálido al final. Muy versátil, ideal de día."],
  'aruba gold':                  [[45, 100, 95, 70],  [100, 70], ['diario', 'salidas', 'playa'],  "Frutas jugosas (chirimoya y manzana dulce) con cítricos sobre un fondo cálido: alegre y luminoso. Ideal de día con clima cálido o templado."],
  'eclaire':                     [[100, 60, 20, 95],  [70, 100], ['citas', 'salidas', 'frio'],    "Caramelo, leche y miel sobre vainilla: un gourmand cremoso y adictivo (estilo Bianco Latte). Ideal con clima fresco, de tarde o de noche."],
  'eclaire banoffi':             [[100, 60, 20, 95],  [65, 100], ['citas', 'salidas', 'frio'],    "Plátano, caramelo y toffee sobre vainilla cremosa: un postre en perfume. Para el frío y las tardes o noches; con calor fuerte, pocos sprays."],
  'eclaire pistache':            [[100, 65, 25, 95],  [70, 100], ['salidas', 'citas', 'frio'],    "Pistacho y almendra con vainilla cremosa: gourmand suave y original. Ideal con clima fresco para salidas y citas."],
  'stallion donna intense':      [[95, 80, 35, 100],  [45, 100], ['citas', 'eventos', 'salidas'], "Jazmín y nardo con vainilla intensa, inspirado en Born in Roma Donna Intense: floral cálido y seductor. Para noches, citas y eventos con clima fresco."],
  'uomo intense':                [[85, 90, 55, 100],  [70, 100], ['oficina', 'citas', 'salidas'], "Lavanda y salvia con pimienta sobre ámbar y cedro: aromático, masculino y versátil. Ideal con clima templado o fresco, de tarde y de noche."],
  'yara elixir':                 [[100, 65, 25, 95],  [55, 100], ['citas', 'salidas', 'frio'],    "Malvavisco, frutos rojos y vainilla: dulce y mimoso (estilo Kayali Yum Boujee). Ideal con clima fresco, de tarde o de noche."],
  'yara moi':                    [[60, 100, 75, 85],  [100, 75], ['diario', 'oficina', 'salidas'], "Durazno y flores blancas sobre almizcle con un toque de pachulí: femenino y luminoso. Ideal de día, en primavera y otoño: oficina, clases y salidas."],
  'yara rosa':                   [[50, 100, 80, 70],  [100, 60], ['diario', 'oficina', 'salidas'], "Rosas frescas con frutas sobre almizcle: romántico y delicado. Perfecto para el día en primavera y verano."],
  'delilah':                     [[65, 100, 70, 85],  [95, 85],  ['salidas', 'citas', 'eventos'], "Rosa con lichi y ruibarbo sobre vainilla y almizcle, inspirado en Delina: romántico y elegante. Ideal en primavera; va de día o de noche."],
  'badee al oud sublime':        [[55, 100, 85, 80],  [100, 85], ['salidas', 'diario', 'citas'],  "Manzana roja jugosa con lichi y rosa (estilo Kayali Eden Juicy Apple): frutal, fresco y adictivo. Ideal en primavera y verano, de día o de noche."],
  'maleka':                      [[80, 100, 60, 90],  [90, 100], ['salidas', 'citas', 'eventos'], "Pera y grosella con rosa y fresia sobre vainilla y sándalo: floral-frutal y femenino. Versátil; luce en salidas, citas y eventos."],
  'the kingdom dama':            [[100, 50, 15, 95],  [35, 100], ['eventos', 'citas', 'frio'],    "Oud, rosa y azafrán sobre ámbar y sándalo: oriental, intenso y elegante. Para noches frescas y ocasiones especiales."],
  'nebras':                      [[100, 60, 15, 95],  [55, 100], ['citas', 'salidas', 'frio'],    "Cacao, vainilla y frutos rojos: dulce, cálido y adictivo (estilo Billie Eilish). Ideal con clima fresco, de tarde y de noche."],
  'yum yum':                     [[90, 95, 50, 90],   [90, 100], ['salidas', 'citas', 'diario'],  "Pera y algodón de azúcar con vainilla: dulce, alegre y muy femenino. Ideal con clima templado o fresco, de día o de noche."],
  'tag':                         [[80, 100, 65, 95],  [90, 100], ['salidas', 'oficina', 'citas'], "Cítricos y pimienta rosa con canela y salvia sobre ámbar: fresco-especiado y versátil. Va bien casi todo el año, de día o de noche."],
  'game of spades full house':   [[55, 100, 95, 80],  [95, 85],  ['oficina', 'salidas', 'diario'], "Cítricos, jengibre y té negro sobre ambroxan, al estilo LV Imagination: fresco, elegante y luminoso. Muy versátil, sobre todo con clima cálido."],
  'game of spades wildcard 3 4': [[90, 70, 40, 100],  [50, 100], ['citas', 'fiestas', 'frio'],    "Especias, azafrán y almendra sobre vainilla, ámbar y maderas: cálido e intenso. Mejor con clima fresco y de noche."],
  'game of spades double bonus': [[40, 100, 95, 70],  [100, 55], ['oficina', 'diario', 'salidas'], "Cítricos jugosos con neroli y especias suaves sobre vetiver: fresco, limpio y elegante. Ideal de día en primavera y verano."],
  'x xandal aromatix':           [[100, 45, 10, 95],  [30, 100], ['citas', 'fiestas', 'frio'],    "Vainilla en todas sus formas con ron, caramelo y haba tonka: muy dulce e intenso. Para noches frías; con calor, uno o dos sprays."],
  'tropical vibe':               [[15, 85, 100, 45],  [100, 60], ['playa', 'salidas', 'diario'],  "Mango, piña y coco con brisa marina: verano en estado puro. Ideal para el calor, la playa y los días de sol."],
  'wolf':                        [[100, 40, 10, 90],  [30, 100], ['fiestas', 'citas', 'frio'],    "Cardamomo, toffee y maderas ambaradas, al estilo Azzaro The Most Wanted: dulce y especiado. Para noches de fiesta y clima fresco."],
  'italia pour homme':           [[100, 50, 10, 95],  [35, 100], ['citas', 'eventos', 'frio'],    "Miel, tabaco y vainilla con lavanda y canela: cálido, dulce y elegante. Ideal para noches frías, citas y eventos."],
  'jasoor':                      [[100, 55, 15, 100], [45, 100], ['citas', 'eventos', 'frio'],    "Especias y tabaco con lavanda sobre cuero y haba tonka: masculino, cálido y con carácter. Para otoño e invierno, de tarde y de noche."],
  'island dreams':               [[25, 95, 100, 60],  [100, 60], ['diario', 'oficina', 'playa'],  "Jengibre, bergamota y pomelo sobre ambroxan: fresco, limpio y luminoso. Ideal para el calor y el día: oficina, clases y salidas."],
  'mykonos dreamscape':          [[55, 100, 90, 80],  [100, 80], ['salidas', 'diario', 'citas'],  "Mango y ruibarbo con jengibre y un toque de praliné, alternativa a God of Fire: frutal, luminoso y llamativo. Ideal con clima cálido o templado."],
  'mykonos conquer':             [[95, 85, 45, 100],  [65, 100], ['citas', 'eventos', 'salidas'], "Cardamomo y jengibre con iris y azahar sobre ámbar: elegante, empolvado y cálido. Ideal con clima fresco, de tarde y de noche."],
  'mykonos reflection':          [[40, 100, 100, 65], [100, 60], ['oficina', 'diario', 'salidas'], "Pomelo, jengibre y mandarina sobre almizcle y ámbar, alternativa a LV Symphony: fresco y luminoso. Ideal de día en primavera y verano."],
  'paladin':                     [[100, 55, 15, 95],  [40, 100], ['citas', 'fiestas', 'frio'],    "Vainilla y lavanda sobre vetiver, al estilo Born in Roma Intense: dulce, aromático y seductor. Para noches frescas, citas y fiestas."]
};

// Nombre del perfume → clave de WEAR_DATA
function wearKey(name) {
  return String(name || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(entero|gift set|set de|set)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// Busca el análisis de un perfume. También prueba el nombre sin la marca
// adelante («Lattafa Khamrah» → «khamrah»).
function wearLookup(p) {
  if (!p || typeof WEAR_DATA === 'undefined') return null;
  const tries = [];
  const name = wearKey(p.name), brand = wearKey(p.brand);
  tries.push(name);
  if (brand && name.startsWith(brand + ' ')) tries.push(name.slice(brand.length + 1));
  for (const k of tries) {
    const key = WEAR_ALIASES[k] || k;
    if (WEAR_DATA[key]) return WEAR_DATA[key];
  }
  return null;
}
