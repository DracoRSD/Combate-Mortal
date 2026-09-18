// Formatos de batalla de Combate Mortal Freestyle — fuente única de verdad
// usada tanto por la pantalla de selección (FormatPicker) como por el
// contador (TimerController / BattleHUD).
//
// mode:
//   'single'    — cronómetro simple, un solo tiempo compartido.
//   'tematica'  — igual que 'single' pero muestra una palabra temática.
//   'turns'     — "ida y vuelta": varias entradas de `time` segundos cada
//                 una, alternando el turno entre los dos MC.
//   'stopwatch' — sin límite de tiempo: cuenta hacia arriba hasta que el
//                 jurado decide terminar.
const Formats = [
  {
    key: 'minutoIdaVuelta',
    name: 'MINUTO IDA Y VUELTA',
    time: 60,
    mode: 'turns',
    entradas: 2,
    description: '60s × 2 entradas'
  },
  {
    key: 'cuatroXcuatro',
    name: '4X4 LIBRE',
    time: 120,
    mode: 'single',
    description: '120 segundos'
  },
  {
    key: 'ochoXocho',
    name: '8X8 TEMÁTICA',
    time: 120,
    mode: 'tematica',
    description: '120s · palabra temática'
  },
  {
    key: 'doceXdoce',
    name: '12X12 IDA Y VUELTA',
    time: 30,
    mode: 'turns',
    entradas: 3,
    description: '30s × 3 entradas'
  },
  {
    key: 'dosXdos',
    name: '2X2 IDA Y VUELTA',
    time: 30,
    mode: 'turns',
    entradas: 5,
    description: '30s × 5 entradas'
  },
  {
    key: 'fatality',
    name: 'FATALITY',
    time: null,
    mode: 'stopwatch',
    description: 'Sin límite · decide el jurado'
  }
];

export default Formats;
