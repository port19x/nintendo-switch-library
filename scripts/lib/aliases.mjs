/**
 * German catalogue title -> English commercial title.
 *
 * Metacritic and HowLongToBeat index English titles, but a German public library
 * catalogues the German release. Most games keep their English name; these are
 * the ones that do not.
 *
 * Keys are canonicalised by normalize.mjs before lookup (lowercased, accents and
 * punctuation stripped, "&" folded to "and"), so write them naturally here —
 * casing, umlauts and apostrophes do not have to match.
 *
 * This module intentionally has no imports: normalize.mjs consumes it, so an
 * import back into normalize.mjs would create a cycle.
 *
 * Extend this when `npm run build` reports an unmatched title that is simply a
 * localised name — the build prints every miss for exactly this purpose.
 */
export const TITLE_ALIASES = {
  // Pokémon generations released under German names
  'Pokémon Karmesin': 'Pokémon Scarlet',
  'Pokémon Purpur': 'Pokémon Violet',
  'Pokémon Strahlender Diamant': 'Pokémon Brilliant Diamond',
  'Pokémon Leuchtende Perle': 'Pokémon Shining Pearl',
  'Pokémon Legenden Arceus': 'Pokémon Legends: Arceus',
  'Pokémon Legenden Z-A': 'Pokémon Legends: Z-A',
  'Pokémon Schwert': 'Pokémon Sword',
  'Pokémon Schild': 'Pokémon Shield',
  "Pokémon Let's Go Pikachu": "Pokémon: Let's Go, Pikachu!",
  "Pokémon Let's Go Evoli": "Pokémon: Let's Go, Eevee!",
  'Pokémon Tekken DX': 'Pokkén Tournament DX',
  'Pokémon Schwert und Schild': 'Pokémon Sword',

  // Nintendo first-party localisations
  'Paper Mario Die Legende vom Äonentor': 'Paper Mario: The Thousand-Year Door',
  'The Legend of Zelda Ein Link zwischen Welten': 'The Legend of Zelda: A Link Between Worlds',
  'Rhythm Paradise Groove': 'Rhythm Heaven Groove',
  'Big Brain Academy Kopf an Kopf': 'Big Brain Academy: Brain vs. Brain',
  'Wario Ware Move it!': 'WarioWare: Move It!',
  'Wario Ware Get it together!': 'WarioWare: Get It Together!',
  'Mario Strikers Battle League Football': 'Mario Strikers: Battle League',
  'Fire Emblem Drei Häuser': 'Fire Emblem: Three Houses',
  'Pui Pui Molcar Let\'s ! Molcar Party': 'Pui Pui Molcar: Let\'s! Molcar Party!',
  'Nintendo Switch Sport': 'Nintendo Switch Sports',
  'Fitness boxing': 'Fitness Boxing',

  'Everybody 1-2-Switch!': 'Everybody 1-2-Switch',
  // Bare shelf titles that collide with an older entry in the same series
  'Nintendo World Championships': 'Nintendo World Championships: NES Edition',
  'Street Fighter': 'Street Fighter 30th Anniversary Collection',
  'Dr. Kawashimas Gehirn-Jogging brandneue Übungen und Klassiker':
    "Dr Kawashima's Brain Training",
  'Snipperclips plus - Zusammen schneidet man am besten ab! der Puzzlespiel- Hit kehrt mit 40 neuen Leveln zurück!':
    'Snipperclips Plus: Cut It Out, Together!',
  'Mario & Sonic bei den Olympischen Spielen - Tokio 2020':
    'Mario & Sonic at the Olympic Games Tokyo 2020',
  'Olympische Spiele - Tokyo 2020': 'Olympic Games Tokyo 2020: The Official Video Game',

  // Catalogue typos — the shelf record is misspelled, the game is real
  'Wobbly L ife': 'Wobbly Life',
  'Final Fantasy Tactica - The Ivalice Chronicles': 'Final Fantasy Tactics: The Ivalice Chronicles',
  'Dragonball Xenovers 2': 'Dragon Ball Xenoverse 2',
  'Dragonball Fighter Z': 'Dragon Ball FighterZ',
  'Dragonball Xenoverse 2': 'Dragon Ball Xenoverse 2',
  'Hello Kitty Island Adventures': 'Hello Kitty Island Adventure',

  // British/American spelling
  'Sonic colours': 'Sonic Colors: Ultimate',

  // Third-party localisations
  'Das Patrick Star Spiel': 'SpongeBob SquarePants: The Patrick Star Game',
  'Chicken Run Eierlauf': 'Chicken Run: Eggstraction',
  'Momento ein gemütlicher Raumdekorator': 'Cozy Room Decorator',
  'Monopoly Star Wars Heroes vs. Villains': 'Monopoly Star Wars',
  'BRATZ Rhythmus & stil': 'Bratz: Rhythm & Style',
  'PAW Patrol Mighty Pups Die Rettung der Abenteuerbucht':
    'PAW Patrol Mighty Pups: Save Adventure Bay',
  'Paw Patrol Rescue Wheels Meisterschaft': 'PAW Patrol Rescue Wheels: Championship',
  "Hot wheels Let's race ultimate speed": "Hot Wheels Let's Race",
  'Pumuckl und die Krone des Piratenkönigs': 'Pumuckl Superspiele',
  'Flügelschlag': 'Wingspan',
  'Mord im Orient Express': 'Agatha Christie - Murder on the Orient Express',
  'Yono und die himmlischen Elefanten': 'Yono and the Celestial Elephants',
  'Spirit - Luckys großes Abenteuer': "Spirit: Lucky's Big Adventure",
  'Trolljäger - Verteidiger von Arcadia': 'Trollhunters: Defenders of Arcadia',
  'Meine Freundin Peppa Pig': 'My Friend Peppa Pig',
  'Notruf 112 der Angriffstrupp': 'Emergency Call 112: The Attack Squad',
  'Harvest Moon - Eine Welt': 'Harvest Moon: One World',
  'Harvest Moon - Licht der Hoffnung': 'Harvest Moon: Light of Hope',
  'Minecraft: Story Mode - Das komplette Abenteuer': 'Minecraft: Story Mode - The Complete Adventure',
  'SpongeBob Schwammkopf - Krosses Kochduell': 'SpongeBob: Krusty Cook-Off',
  'Spongebob Schwammkopf - Battle for Bikini Bottom Rehydrated':
    'SpongeBob SquarePants: Battle for Bikini Bottom - Rehydrated',
  'My Universe - Meine Tierklinik: Hund & Katze': 'My Universe: Pet Clinic Cats & Dogs',

  // Licensed children's series with German release names
  'Die Schlümpfe': 'The Smurfs',
  'Die Schlümpfe - Mission Blattpest': 'The Smurfs: Mission Vileaf',
  'Die Schlümpfe 2 der Gefangene des grünen Steins': 'The Smurfs 2: The Prisoner of the Green Stone',
  'Die Schlümpfe - Village Party 50 Spiele': 'The Smurfs: Village Party',
  'Hotel Transsilvanien 3 Monster über Bord': 'Hotel Transylvania 3: Monsters Overboard',
  'Hotel Transsilvanien schaurig-schöne Abenteuer': 'Hotel Transylvania: Scary-Tale Adventures',
  "Gabby's dollhouse - Bereit für die Party": "Gabby's Dollhouse: Party Time",
  'Rainbow High - Leben für den Laufsteg': 'Rainbow High: Runway Rush',
  'Bratz - Mode Weltweit': 'Bratz: Flaunt Your Fashion',
  'Dragons - Legenden der 9 Welten': 'DreamWorks Dragons: Legends of The Nine Realms',
  'PAW Patrol - der Kinofilm die Rettung der Abenteuerbucht':
    'PAW Patrol The Movie: Adventure City Calls',
  'PAW Patrol: Im Einsatz': 'PAW Patrol: On A Roll',
  'DC League of Super-Pets die Abentuer von Krypto und Ace':
    'DC League of Super-Pets: The Adventures of Krypto and Ace',
  'Ostwind - Das Spiel': 'Windstorm: An Unexpected Arrival',
  'Ostwind - Aris Ankunft': "Windstorm: Ari's Arrival",
  'Ostwind - Beginn einer wunderbaren Freudschaft': 'Windstorm: Start of a Great Friendship',
};
