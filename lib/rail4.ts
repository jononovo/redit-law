import { randomBytes } from "crypto";

const DECOY_WORDS = [
  "extricate", "illuminate", "tessellate", "arbitrary", "clandestine",
  "ephemeral", "gratuitous", "labyrinth", "meticulous", "nonchalant",
  "oscillate", "perpetuate", "quintuple", "reverberate", "surreptitious",
  "ubiquitous", "vindicate", "wherewithal", "amalgamate", "benevolent",
  "circumvent", "delineate", "enumerate", "fabricate", "galvanize",
  "hypothesize", "juxtapose", "kaleidoscope", "luxuriant", "magnanimous",
  "necessitate", "obliterate", "precipitate", "reciprocate", "substantiate",
  "transcendent", "unilateral", "vernacular", "corroborate", "dichotomy",
  "equilibrium", "fastidious", "idiosyncratic", "nomenclature", "paradoxical",
  "recalcitrant", "serendipity", "tantamount", "vicissitude", "acquiesce",
];

const FAKE_FIRST_NAMES = [
  "Sarah", "James", "Emily", "Michael", "Olivia", "Daniel", "Sophia", "Matthew",
  "Ava", "Christopher", "Isabella", "Andrew", "Mia", "Joshua", "Charlotte",
  "David", "Amelia", "Ryan", "Harper", "Nathan",
];

const FAKE_LAST_NAMES = [
  "Mitchell", "Anderson", "Thompson", "Garcia", "Martinez", "Robinson", "Clark",
  "Rodriguez", "Lewis", "Lee", "Walker", "Hall", "Allen", "Young", "King",
  "Wright", "Scott", "Green", "Baker", "Adams",
];

const FAKE_STREETS = [
  "Oak Avenue", "Maple Drive", "Cedar Lane", "Pine Street", "Elm Court",
  "Birch Road", "Walnut Boulevard", "Spruce Way", "Willow Circle", "Ash Place",
  "Cherry Lane", "Hickory Drive", "Poplar Avenue", "Sycamore Street", "Magnolia Court",
];

const FAKE_CITIES_STATES_ZIPS = [
  { city: "Portland", state: "OR", zip: "97201" },
  { city: "Austin", state: "TX", zip: "78701" },
  { city: "Denver", state: "CO", zip: "80202" },
  { city: "Seattle", state: "WA", zip: "98101" },
  { city: "Nashville", state: "TN", zip: "37201" },
  { city: "Raleigh", state: "NC", zip: "27601" },
  { city: "Salt Lake City", state: "UT", zip: "84101" },
  { city: "Minneapolis", state: "MN", zip: "55401" },
  { city: "Charlotte", state: "NC", zip: "28201" },
  { city: "Tampa", state: "FL", zip: "33601" },
  { city: "Phoenix", state: "AZ", zip: "85001" },
  { city: "Columbus", state: "OH", zip: "43201" },
  { city: "San Diego", state: "CA", zip: "92101" },
  { city: "Indianapolis", state: "IN", zip: "46201" },
  { city: "Jacksonville", state: "FL", zip: "32201" },
];

const VALID_BIN_PREFIXES = [
  "4532", "4716", "4929", "4485", "4556",
  "5425", "5178", "5392", "5213", "5301",
];

export interface FakeProfile {
  profileIndex: number;
  name: string;
  cardNumberMasked: string;
  cvv: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}

export interface Rail4Setup {
  decoyFilename: string;
  realProfileIndex: number;
  missingDigitPositions: number[];
  fakeProfiles: FakeProfile[];
  decoyFileContent: string;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDigit(): string {
  return Math.floor(Math.random() * 10).toString();
}

function randomDigits(count: number): string {
  let result = "";
  for (let i = 0; i < count; i++) {
    result += randomDigit();
  }
  return result;
}

function generateRandomCVV(): string {
  return String(100 + Math.floor(Math.random() * 900));
}

function generateFakeCardNumber(missingPositions: number[]): string {
  const bin = pickRandom(VALID_BIN_PREFIXES);
  let digits = bin;
  for (let i = 5; i <= 16; i++) {
    if (missingPositions.includes(i)) {
      digits += "X";
    } else {
      digits += randomDigit();
    }
  }
  return digits;
}

export function generateDecoyFilename(): string {
  return pickRandom(DECOY_WORDS) + ".md";
}

export function pickMissingDigitPositions(): number[] {
  const start = 7 + Math.floor(Math.random() * 4);
  return [start, start + 1, start + 2];
}

function generateFakeProfile(index: number, missingPositions: number[]): FakeProfile {
  const firstName = pickRandom(FAKE_FIRST_NAMES);
  const lastName = pickRandom(FAKE_LAST_NAMES);
  const streetNum = 100 + Math.floor(Math.random() * 9900);
  const street = pickRandom(FAKE_STREETS);
  const location = pickRandom(FAKE_CITIES_STATES_ZIPS);

  return {
    profileIndex: index,
    name: `${firstName} ${lastName}`,
    cardNumberMasked: generateFakeCardNumber(missingPositions),
    cvv: generateRandomCVV(),
    addressLine1: `${streetNum} ${street}`,
    city: location.city,
    state: location.state,
    zip: location.zip,
  };
}

function buildDecoyFileContent(
  fakeProfiles: FakeProfile[],
  realProfileIndex: number,
  missingPositions: number[]
): string {
  let content = `# Payment Profiles\n\n`;
  content += `> This file contains your payment profiles. Each profile includes partial card data.\n`;
  content += `> The 3 digits at positions ${missingPositions.join(", ")} are held separately for security.\n`;
  content += `> Do NOT include expiry dates in this file.\n\n`;
  content += `---\n\n`;

  for (let i = 1; i <= 6; i++) {
    content += `## Profile ${i}\n\n`;

    const fake = fakeProfiles.find(fp => fp.profileIndex === i);
    if (fake) {
      content += `- **Name:** ${fake.name}\n`;
      content += `- **Card Number:** ${fake.cardNumberMasked}\n`;
      content += `- **CVV:** ${fake.cvv}\n`;
      content += `- **Address:** ${fake.addressLine1}\n`;
      content += `- **City:** ${fake.city}\n`;
      content += `- **State:** ${fake.state}\n`;
      content += `- **Zip:** ${fake.zip}\n`;
    } else {
      content += `- **Name:** [YOUR NAME]\n`;
      content += `- **Card Number:** [YOUR CARD NUMBER WITH POSITIONS ${missingPositions.join(", ")} AS XXX]\n`;
      content += `- **CVV:** [YOUR CVV]\n`;
      content += `- **Address:** [YOUR ADDRESS]\n`;
      content += `- **City:** [YOUR CITY]\n`;
      content += `- **State:** [YOUR STATE]\n`;
      content += `- **Zip:** [YOUR ZIP]\n`;
    }

    content += `\n---\n\n`;
  }

  return content;
}

export function generateRail4Setup(): Rail4Setup {
  const decoyFilename = generateDecoyFilename();
  const realProfileIndex = 1 + Math.floor(Math.random() * 6);
  const missingDigitPositions = pickMissingDigitPositions();

  const fakeProfiles: FakeProfile[] = [];
  for (let i = 1; i <= 6; i++) {
    if (i !== realProfileIndex) {
      fakeProfiles.push(generateFakeProfile(i, missingDigitPositions));
    }
  }

  const decoyFileContent = buildDecoyFileContent(fakeProfiles, realProfileIndex, missingDigitPositions);

  return {
    decoyFilename,
    realProfileIndex,
    missingDigitPositions,
    fakeProfiles,
    decoyFileContent,
  };
}
