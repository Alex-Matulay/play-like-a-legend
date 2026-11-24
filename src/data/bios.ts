import type { GmId } from '../types'

export interface Bio {
  firstName: string
  born: string
  died: string
  title: string
  intro: string
  sections: { heading: string; body: string[] }[]
}

export const BIOS: Partial<Record<GmId, Bio>> = {
  tal: {
    firstName: 'Mikhail',
    born: '9 November 1936, Riga, Latvia',
    died: '28 June 1992, Moscow',
    title: '8th World Chess Champion (1960–1961)',
    intro:
      'Mikhail Tal played chess as if the rules of material did not apply to him. He sacrificed pieces on instinct, trusted that the complications would favour the bolder player, and was usually right.',
    sections: [
      {
        heading: 'The boy from Riga',
        body: [
          'Tal grew up in Riga, the son of a doctor. He was a quick, restless child who learned chess at the local Palace of Pioneers and was soon beating adults across the city. He was born with only three fingers on his right hand, which never slowed him down at the board.',
          'He won his first Soviet Championship in 1957, aged 20, and defended it the following year. Older masters complained that his sacrifices were unsound. Tal kept winning with them anyway.',
        ],
      },
      {
        heading: 'Youngest world champion of his time',
        body: [
          'In 1960 he challenged Mikhail Botvinnik, the methodical champion of the Soviet school, and beat him 12½–8½. At 23, Tal was the youngest world champion there had ever been, and the press called him the Magician from Riga.',
          'Botvinnik won the return match a year later. Tal was already seriously ill with kidney problems that would trouble him for the rest of his life, and he played much of that rematch in poor health.',
        ],
      },
      {
        heading: 'A long second act',
        body: [
          'He never won the title back, but he stayed one of the strongest players in the world for three decades. He won the Soviet Championship six times in all, and in 1973–74 went 95 tournament games without a loss, one of the longest unbeaten runs in top level chess.',
          'Friends remembered him as warm, witty and generous, and he was loved by fans in a way few champions are. He kept playing almost to the end: weeks before he died in 1992 he was still competing in blitz events in Moscow, and he beat Garry Kasparov in one of those games.',
        ],
      },
      {
        heading: 'How he played',
        body: [
          'Tal believed that a position full of threats is hard to defend over the board, even if a computer could later find the refutation. He gave up material to open lines towards the king, kept the initiative, and made his opponents solve one problem after another until they went wrong.',
          'That is the spirit of this pack: every puzzle rewards the player who looks at the most forcing, most daring move first.',
        ],
      },
    ],
  },
  capablanca: {
    firstName: 'José Raúl',
    born: '19 November 1888, Havana, Cuba',
    died: '8 March 1942, New York',
    title: '3rd World Chess Champion (1921–1927)',
    intro:
      'José Raúl Capablanca made chess look easy. His games are models of clarity: simple moves, perfectly placed pieces and endgames won with almost no visible effort.',
    sections: [
      {
        heading: 'A natural talent',
        body: [
          'According to the famous story, Capablanca learned the moves at the age of four by watching his father play, and pointed out a mistake his father had made. By thirteen he had beaten the champion of Cuba in a match.',
          'He studied at Columbia University in New York, but chess soon took over. In 1909 he crushed Frank Marshall, the leading American player, and in 1911 he won the strong San Sebastián tournament at his first attempt.',
        ],
      },
      {
        heading: 'World champion',
        body: [
          'In 1921 he took the world title from Emanuel Lasker in Havana without losing a single game. For years he lost so rarely that he gained a reputation as a "chess machine".',
          'He lost the title to Alexander Alekhine in Buenos Aires in 1927 and never got a rematch. He also served as a Cuban diplomat and wrote Chess Fundamentals, still one of the most recommended books for improving players.',
        ],
      },
      {
        heading: 'How he played',
        body: [
          'Capablanca valued simplicity above everything. He traded into endgames he understood better than anyone, kept his pieces coordinated, and rarely needed long calculations because his positions were so clean.',
        ],
      },
    ],
  },
  morphy: {
    firstName: 'Paul',
    born: '22 June 1837, New Orleans, USA',
    died: '10 July 1884, New Orleans, USA',
    title: 'Unofficial world champion of his era',
    intro:
      'Paul Morphy burst onto the chess world for barely two years and beat everyone. Then he walked away from the game for good, which is why he is remembered as "the pride and sorrow of chess".',
    sections: [
      {
        heading: 'A prodigy in New Orleans',
        body: [
          'Morphy learned chess as a child in New Orleans and was beating the city\'s best players while still a boy. He was also a brilliant student and finished a law degree before he was old enough to practise.',
          'In 1857 he won the First American Chess Congress in New York with ease.',
        ],
      },
      {
        heading: 'Conquering Europe',
        body: [
          'In 1858 he sailed to Europe and beat the leading masters there, including Adolf Anderssen, widely seen as the best player in the world. He gave blindfold exhibitions against several opponents at once and became a celebrity.',
          'In Paris he played his most famous game, the "Opera Game", during a performance at the opera house, against the Duke of Brunswick and Count Isouard in consultation. It is still used to teach rapid development.',
        ],
      },
      {
        heading: 'Leaving the game',
        body: [
          'Back home, Morphy largely stopped playing serious chess and tried to build a law career, which never took off. He became increasingly withdrawn in later life and died in New Orleans in 1884, aged 47.',
        ],
      },
      {
        heading: 'How he played',
        body: [
          'Morphy understood, long before it was written down, that quick development and open lines decide games. He got his pieces out, opened the position while his opponent was still undeveloped, and finished with crisp combinations.',
        ],
      },
    ],
  },
  petrosian: {
    firstName: 'Tigran',
    born: '17 June 1929, Tbilisi, Georgia',
    died: '13 August 1984, Moscow',
    title: '9th World Chess Champion (1963–1969)',
    intro:
      'Tigran Petrosian was the hardest player of his generation to beat. Where Tal attacked, Petrosian prevented: he saw his opponent\'s plans coming and quietly made them impossible.',
    sections: [
      {
        heading: 'Hard beginnings',
        body: [
          'Petrosian was born in Tbilisi to an Armenian family and lost both his parents during the Second World War, while he was still a child. Chess became his refuge. He was deeply influenced by Aron Nimzowitsch\'s book My System and its ideas about prophylaxis.',
        ],
      },
      {
        heading: 'World champion',
        body: [
          'He won the Soviet Championship four times and in 1963 took the world title from Mikhail Botvinnik. He defended it against Boris Spassky in 1966, then lost to Spassky in 1969.',
          'He also earned a higher degree in philosophy and edited the Soviet chess newspaper 64.',
        ],
      },
      {
        heading: 'How he played',
        body: [
          'Petrosian\'s trademark was prophylaxis: improving his position while taking away his opponent\'s best ideas. He was famous for positional exchange sacrifices, giving a rook for a minor piece to gain lasting control. In his best years he went entire tournaments without losing a game, which earned him the nickname "Iron Tigran".',
        ],
      },
    ],
  },
}
