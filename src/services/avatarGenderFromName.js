// Infer a speaking gender from an avatar's given name so a standard voice
// can be chosen before anyone uploads a clone. Unisex and unknown names
// return null: the caller decides the catalogue fallback.

const IGNORED_NAME_PREFIXES = new Set([
  'a.i',
  'ai',
  'dr',
  'mr',
  'mrs',
  'ms',
  'miss',
  'mx',
  'prof',
  'sir',
  'dame',
  'lord',
  'lady',
  'rev',
  'the',
]);

const FEMALE_GIVEN_NAMES = new Set(
  `
  ada adriana alexandra alice alicia allison alyssa amanda amelia amy angela
  anita anna anne annie april aria ariana asha audrey aurora
  barbara beatrice belinda bernice beth betty beverly bianca bonnie brenda
  brianna britany britney brooke
  camila camille candace cara carla carmen carol carolina caroline carolyn
  cassandra catherine cathy cecilia celeste celia charlotte cheryl chloe
  christine christina cindy claire clara clarissa colette colleen courtney
  crystal cynthia
  daisy dana danielle daphne darlene dawn deanna debbie deborah denise diana
  diane donna dora doris dorothy
  edith edna eileen elaine eleanor elena elisa elisabeth elise eliza elizabeth
  ella ellen ellie eloise elsa elsie elvira emily emma erica erika erin esther
  ethel eva eve evelyn
  faith fiona flora frances francesca
  gabriela gabrielle gail gina giorgia giorgina giselle gloria grace greta
  gretchen gwen gwendolyn
  hannah harley harriet haze hazel heather heidi helen helena hollie holly hope
  irene iris irma isabel isabella isabelle ivy
  jackie jacoba jacqueline jade jamie jane janet janice jasmine jean jeanette
  jenna jennifer jenny jessica jill joan joann joanna joanne jocelyn jodi
  josephine joy joyce judith judy julia juliana julie juliet justine
  kaitlin kaitlyn kara karen kari karla katherine kathleen kathryn kathy katie
  katrina kayla kaylee kelly kelsey kendra kerry kim kimberly kira kristen
  kristin kristina krystal kylie
  lacey lana larissa laura lauren laurie leah leila lena leona lesley leslie
  letha leticia lillian lily linda lindsay lisa liza lois lola loretta lori
  lorraine louise lucia lucille lucy lydia lynn
  mabel madeleine madeline madison mae maeve maggie maia mandy marcia margaret
  margot maria marianne marie marilyn marina marisa marisol marjorie marlene
  martha mary maryam maureen mavis maxine maya megan meghan melanie melinda
  melissa melody mercedes meredith mia michelle mildred millie miranda miriam
  misty molly monica morgan myra myrtle
  nadia nadine nancy naomi natalie natalia natasha nellie nicole nina noelle
  nora nora noreen norma
  olga olivia
  paige pam pamela patricia patty paula pauline pearl peggy penelope penny
  phyllis polly priscilla
  rachel ramona rebecca regina renee rhonda rita roberta robin robyn rosa
  rosalie rose rosemary rosie roxanne ruby ruth
  sabrina sally samantha sandra sandy sara sarah sasha selena selma serena
  shania shannon sharon sheila shelley sherry shirley shivon sierra sonia
  sonya sophia sophie stacey stacy stella stephanie susan susanna susanne
  suzanne sydney sylvia
  tabitha tamara tami tammy tanya tara teresa terri theresa tiffany tina toni
  tonya tracey tracy
  valerie vanessa vera veronica vicki vickie victoria violet virginia vivian
  wanda wendy whitney willow wilma winifred
  yasmin yolanda yvette yvonne
  zelda zoe zoey
  `
    .trim()
    .split(/\s+/)
);

const MALE_GIVEN_NAMES = new Set(
  `
  aaron abdul abel abraham adam adrian alan albert alec alejandro alex
  alexander alfred ali allan allen alvin andre andreas andrew andy angel
  anthony antonio archie arnold arthur austin
  barry ben benjamin bernard bert bill billy bob bobby brad bradley brandon
  brendan brent brett brian bruce bryan
  caleb calvin cameron carl carlos cecil cedric charles charlie chester chris
  christian christopher clarence clark claude clayton clifford clint clinton
  clyde cody colin conor corey cory craig curtis cyril cyrus
  dale damian damon dan daniel danny darren darryl dave david dean dennis
  derek devin diego dominic don donald douglas drew duane duncan dwayne dylan
  earl ed eddie edgar edmund edward edwin eli elias elijah elliot elliott
  elmer emil emmanuel eric erik ernest ernie ethan eugene evan
  felix fernando floyd forrest francis frank franklin fred frederick
  gabriel garrett gary gavin gene geoffrey george gerald gerry gilbert glenn
  gordon graham grant greg gregory guy
  harold harry harvey henry herbert herman homer howard hugh hunter
  ian isaac isaiah ivan
  jack jackson jacob jake james jamie jared jason javier jay jed jedediah jeff
  jeffrey jeremiah jeremy jerome jerry jesse jim jimmy joe joel joey john
  johnny jon jonathan jordan jorge jose joseph josh joshua juan julian julio
  justin
  karl keith ken kenneth kenny kevin kirk kirkland kurt kyle
  lance larry lawrence lee leo leon leonard leroy leslie lester lewis lloyd
  logan louis lucas luis luke
  malcolm manuel marc marco marcus mario mark marshall martin marvin mason
  mathew matt matthew maurice max melvin michael micheal mick mickey miguel
  mike milton mitchell mohamed mohammad mohammed morris murray
  nathan nathaniel neil nelson nicholas nick nicolas noah norman
  oliver omar oscar otis otto owen
  pablo patrick pat paul perry pete peter phil philip phillip preston
  quentin quincy
  ralph ramon randall randy raul ray raymond reginald ricardo richard rick
  ricky rob robbie robert robin rod rodney roger roland ron ronald ross roy
  ruben russell ryan
  sam samuel scott sean sebastian sergio seth shane shaun shawn sidney simon
  spencer stanley stephen steve steven stewart stuart
  ted teddy terence terrence terry theodore thomas tim timothy tobias todd
  tom tommy tony travis trevor troy tyler tyrone
  ulysses
  vernon vic victor vincent vince virgil
  wade wallace walter warren wayne wesley will wallace william willie wilson
  wyatt
  xavier
  zach zachary zack
  `
    .trim()
    .split(/\s+/)
);

/**
 * The given name to judge, skipping titles such as "A.I." or "Dr".
 *
 * @param {string} [fullName]
 * @returns {string}
 */
export function givenNameOfAvatar(fullName) {
  const tokens = String(fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (const token of tokens) {
    const letters = token.replace(/[^A-Za-z'-]/g, '');
    if (!letters) continue;
    const key = letters.toLowerCase().replace(/\./g, '');
    if (IGNORED_NAME_PREFIXES.has(key)) continue;
    return letters;
  }
  return '';
}

/**
 * @param {string} [fullName]
 * @returns {'female'|'male'|null}
 */
export function inferAvatarGenderFromName(fullName) {
  const given = givenNameOfAvatar(fullName).toLowerCase();
  if (!given) return null;
  if (FEMALE_GIVEN_NAMES.has(given) && MALE_GIVEN_NAMES.has(given)) return null;
  if (FEMALE_GIVEN_NAMES.has(given)) return 'female';
  if (MALE_GIVEN_NAMES.has(given)) return 'male';
  return null;
}
