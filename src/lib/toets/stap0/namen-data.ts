/**
 * Namenlijst voor stap 0 (regel van Nick: ALLEEN westerse/Nederlandse voornamen). Personen in een vraagstuk die niet
 * op deze lijst staan, worden deterministisch vervangen door een naam van deze lijst (zie namen.ts). Geen keuring,
 * geen Grok-aanroep.
 */

/** Gangbare Nederlandse/westerse meisjesnamen. */
export const MEISJES = [
  "Anna", "Anne", "Annelies", "Anouk", "Astrid", "Bente", "Bo", "Britt", "Carlijn", "Caroline", "Charlotte", "Claire",
  "Daphne", "Demi", "Denise", "Diana", "Dewi", "Eline", "Elise", "Ellen", "Els", "Emma", "Esmee", "Esther", "Eva",
  "Evi", "Evy", "Fay", "Femke", "Fenna", "Fien", "Fleur", "Floor", "Floortje", "Frederique", "Gwen", "Hanna", "Hannah",
  "Hester", "Ilse", "Inge", "Iris", "Isa", "Isabel", "Isabelle", "Ivy", "Jade", "Janna", "Janne", "Jasmijn", "Jente",
  "Jet", "Jill", "Joanne", "Jolien", "Josephine", "Julia", "Julie", "Juliette", "Jasmin", "Karin", "Kate", "Kim",
  "Kiki", "Lana", "Laura", "Lauren", "Lena", "Lieke", "Lieve", "Lies", "Lin", "Linda", "Linde", "Lisa", "Lise",
  "Liv", "Liz", "Loes", "Lois", "Lot", "Lotte", "Louise", "Lucy", "Luna", "Lynn", "Madelief", "Manon", "Mara",
  "Margot", "Maria", "Marieke", "Marit", "Marleen", "Marloes", "Maud", "Maxime", "Megan", "Merel", "Mila", "Milou",
  "Mirjam", "Mirthe", "Myrthe", "Naomi", "Nienke", "Nina", "Noa", "Noor", "Noortje", "Nora", "Olivia", "Patricia",
  "Puck", "Quinty", "Renske", "Rianne", "Rosa", "Roos", "Rosalie", "Saar", "Sam", "Sanne", "Sara", "Sarah", "Selma",
  "Sofie", "Sophie", "Sophia", "Stella", "Suze", "Suus", "Tess", "Tessa", "Thirza", "Tirza", "Vera", "Veerle",
  "Wendy", "Willemijn", "Yara", "Yvonne", "Zoë", "Amber", "Amy", "Babette", "Chloé", "Danique", "Elin", "Elisa",
  "Fenne", "Ginger", "Imke", "Isis", "Joyce", "Kaylee", "Lara", "Lizzy", "Marije", "Mieke", "Nikki", "Pien",
  "Romy", "Ruth", "Silke", "Tamara", "Wies", "Jenny", "Tina", "Mia", "Thea", "Liesbeth", "Lydia", "Ingrid", "Monique", "Sandra", "Petra", "Anja", "Marjolein", "Hilde", "Greet", "Truus", "Ria", "Joke", "Kirsten", "Sabine", "Eveline", "Sofia", "Ines", "Inès", "Elena", "Lina", "Emily", "Lily", "Ella", "Nova", "Evelien", "Hannelore", "Johanna", "Mirte", "Fenja", "Esmée",
] as const;

/** Gangbare Nederlandse/westerse jongensnamen. */
export const JONGENS = [
  "Aart", "Alexander", "Arjan", "Arthur", "Bart", "Bas", "Bastiaan", "Ben", "Benjamin", "Bert", "Bob", "Boris", "Bram",
  "Brent", "Casper", "Cas", "Chris", "Christiaan", "Coen", "Daan", "Damian", "Daniel", "David", "Dennis", "Dirk",
  "Dylan", "Edwin", "Erik", "Ewout", "Fabian", "Felix", "Finn", "Floris", "Frank", "Frans", "Freek", "Gerben",
  "Gerrit", "Gijs", "Hans", "Hendrik", "Henk", "Hugo", "Huub", "Ivo", "Jaap", "Jacob", "Jan", "Jari", "Jasper",
  "Jelle", "Jens", "Jeroen", "Jesse", "Job", "Joep", "Johan", "Jonas", "Joost", "Joris", "Jorrit", "Jules", "Julian",
  "Jurre", "Justin", "Kai", "Kees", "Kevin", "Klaas", "Koen", "Lars", "Laurens", "Lennard", "Levi", "Liam", "Lucas",
  "Luc", "Luuk", "Mark", "Martijn", "Mats", "Matthijs", "Max", "Maarten", "Mees", "Melle", "Michiel",
  "Mick", "Mike", "Milan", "Niek", "Niels", "Noah", "Olivier", "Oscar", "Otto", "Pascal", "Patrick", "Paul", "Pepijn",
  "Peter", "Pieter", "Pim", "Quinten", "Ralph", "Ramon", "Rick", "Rik", "Rob", "Robin", "Roel", "Ruben", "Rutger",
  "Ruud", "Sander", "Sebastiaan", "Sem", "Siem", "Simon", "Stan", "Stef", "Stefan", "Sven", "Stijn", "Teun", "Thijs",
  "Thomas", "Tijn", "Tim", "Timo", "Tobias", "Tom", "Tristan", "Twan", "Victor", "Vincent", "Wessel", "Willem",
  "Wim", "Wouter", "Xander", "Yannick", "Youri", "Zeger", "Abel", "Adam", "Bjorn", "Dani", "Duco", "Ezra", "Guus",
  "Hidde", "Ids", "Jochem", "Kasper", "Lex", "Morris", "Nick", "Oliver", "Owen", "Reinier", "Sepp",
  "Siebe", "Sil", "Ties", "Valentijn", "Ward", "Jos", "Herman", "Martin", "Roy", "Gerard", "Marcel", "Ronald", "René", "Rudy", "Theo", "Ton", "Leo", "Harm", "Geert", "Arie", "Marco", "Richard", "Robert", "Jordy", "Ricardo", "Luca", "Mateo", "Leon", "Elias", "Hidde-Jan", "Jayden", "Ryan", "Thijmen", "Gerlof", "Wybren",
] as const;

/** Alle toegestane voornamen (uniek). */
export const WESTERSE_NAMEN: readonly string[] = [...new Set<string>([...MEISJES, ...JONGENS])];

/**
 * Veelvoorkomende niet-westerse voornamen (met geslacht): worden altijd als persoon herkend en vervangen, ook op een
 * plek waar de algemene herkenning twijfelt.
 */
export const NIET_WESTERS: Record<string, "m" | "v"> = Object.fromEntries([
  ...["Fatima", "Fatma", "Aisha", "Aïsha", "Aicha", "Jamila", "Latifa", "Ayesha", "Amina", "Yasmina", "Yasmin", "Zainab", "Zeynep", "Ayse", "Ayşe", "Elif", "Meryem", "Maryam", "Nour", "Salma", "Samira", "Hafsa", "Khadija", "Leila", "Layla", "Laila", "Imane", "Ikram", "Priya", "Anjali", "Ling", "Esra", "Hatice", "Naima", "Rania", "Dounia", "Malika", "Kenza", "Aaliyah", "Sumaya", "Hiba", "Asma", "Noura", "Yousra", "Safae", "Wiam"].map((n) => [n, "v"] as const),
  ...["Youssef", "Yusuf", "Jamal", "Djamal", "Jamil", "Rayan", "Ayman", "Youssouf", "Mohammed", "Mohamed", "Muhammad", "Mehmet", "Ahmed", "Ahmet", "Ali", "Omar", "Ömer", "Hamza", "Ibrahim", "Ismail", "Mustafa", "Hassan", "Hussein", "Karim", "Khalid", "Mounir", "Rachid", "Bilal", "Ayoub", "Anas", "Amir", "Emre", "Burak", "Mert", "Murat", "Ilias", "Ilyas", "Adem", "Yassin", "Yassine", "Mohcine", "Tarik", "Raj", "Arjun", "Rohan", "Wei", "Jun", "Kofi", "Kwame", "Abdel", "Abdullah", "Said", "Redouan", "Nabil", "Zakaria", "Zakariya", "Achraf", "Sami", "Soufian", "Soufiane"].map((n) => [n, "m"] as const),
]);

/** Woorden met een hoofdletter die geen persoon zijn (aanvulling op het zinsbegin). */
export const GEEN_PERSOON = new Set<string>([
  "Binas", "Toetski", "Nederland", "Nederlands", "Nederlandse", "Europa", "Europese", "Duitsland", "België", "Frankrijk",
  "Engeland", "Amsterdam", "Rotterdam", "Utrecht", "Den", "Haag", "Groningen", "Eindhoven", "Zwolle", "Maastricht",
  "Noordzee", "Rijn", "Maas", "Waddenzee", "Schiphol", "Aarde", "Maan", "Zon", "Mars", "Jupiter", "Venus", "Celsius",
  "Kelvin", "Fahrenheit", "Newton", "Joule", "Watt", "Volt", "Ampère", "Ohm", "Hertz", "LED", "CSE", "SE",
  "PTA", "NaSk", "Wet", "Archimedes", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag",
  "Zondag", "Januari", "Februari", "Maart", "April", "Juni", "Juli", "Augustus", "September", "Oktober",
  "November", "December", "Kerst", "Pasen", "Koningsdag", "Sinterklaas", "Tabel", "Figuur", "Vraag", "Grafiek",
  "Bereken", "Leg", "Noteer", "Teken", "Construeer", "Bepaal", "Omcirkel", "Toon", "Geef", "Maak", "Zet", "Kruis",
  "Beschrijf", "Vergelijk", "Deel", "Je", "Hij", "Zij", "Ze", "Het", "De", "Een", "Er", "Dit", "Dat", "Deze", "Die",
  "Hoe", "Wat", "Waarom", "Welke", "Wanneer", "Waar", "Wie", "In", "Op", "Bij", "Na", "Voor", "Met", "Van", "Om",
  "Als", "Omdat", "Daarna", "Dan", "Ook", "Juist", "Antwoord", "Uitwerking", "Formule", "Berekening",
  "Gegeven", "Gevraagd", "Oplossing", "Stroom", "Spanning", "Weerstand", "Vermogen", "Energie", "Massa", "Kracht",
  "Fz", "Fres", "Fn", "Fw", "Fs",
]);
