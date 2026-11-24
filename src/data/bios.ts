import type { GmId } from '../types'

export interface Bio {
  firstName: string
  born: string
  died: string
  title: string
  intro: string
  sections: { heading: string; body: string[] }[]
}

/**
 * Facts here were checked against Wikipedia (November 2026): the players' own articles plus the
 * World Chess Championship 1921 and 1927 articles and the Opera Game article. Keep new claims to
 * things a source states; style descriptions in "How he played" are the site's own summary.
 */
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
          'Tal grew up in Riga and joined the chess club at the Riga Palace of Young Pioneers as a boy. He was born with ectrodactyly, a congenital deformity of his right hand, which never held him back at the board.',
          'In 1957, aged 20, he became the youngest player to win the Soviet Championship, and he kept the title the following year. Critics called many of his sacrifices unsound. Tal kept winning with them anyway.',
        ],
      },
      {
        heading: 'Youngest world champion of his time',
        body: [
          'In 1960 he challenged Mikhail Botvinnik, the methodical champion of the Soviet school, and beat him 12½–8½. At 23, Tal was the youngest world champion there had ever been, a record that stood until Garry Kasparov in 1985. He earned the nickname the Magician from Riga.',
          'Botvinnik won the return match a year later, 13–8. Tal suffered from chronic kidney problems, and doctors had advised postponing the rematch. He played anyway, and his health contributed to the defeat.',
        ],
      },
      {
        heading: 'A long second act',
        body: [
          'He never won the title back, but he stayed one of the strongest players in the world for three decades. He won the Soviet Championship six times in all, and between October 1973 and October 1974 he played 95 games in a row without a loss (46 wins and 49 draws).',
          'He kept playing almost to the end. On 28 May 1992, at a blitz tournament in Moscow, he beat Garry Kasparov. He died one month later.',
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
          'Capablanca learned the game at the age of four by watching his father play. The story goes that he pointed out an illegal move his father had made, then beat him. In November 1901, two days before his 13th birthday, he beat the Cuban champion Juan Corzo in a match.',
          'He went to Columbia University in New York, but chess soon took over. In 1909 he beat the US champion Frank Marshall by 8 wins to 1, with 14 draws, and in 1911 he won the strong San Sebastián tournament ahead of Rubinstein, Nimzowitsch and Tarrasch.',
        ],
      },
      {
        heading: 'World champion',
        body: [
          'In 1921 he took the world title from Emanuel Lasker in his home city of Havana, with 4 wins, 10 draws and not a single loss. In serious play he went unbeaten from February 1916 to March 1924.',
          'He lost the title to Alexander Alekhine in Buenos Aires in 1927 and, despite years of trying, never got a rematch. He joined the Cuban Foreign Office in 1913 and served his country as a diplomat. He also wrote Chess Fundamentals, which Mikhail Botvinnik regarded as the best chess book ever written.',
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
          "Morphy learned chess as a child in New Orleans, and by the age of nine he was considered one of the best players in the city. He was also a brilliant student: he earned his law degree in 1857, before he was old enough to practise.",
          'In 1857 he won the First American Chess Congress in New York with ease.',
        ],
      },
      {
        heading: 'Conquering Europe',
        body: [
          "In 1858 he sailed to Europe and beat the leading masters there. Against Adolf Anderssen, considered by many to be Europe's leading player, he won 7 games, lost 2 and drew 2. In Paris he played eight opponents at once while blindfolded, and beat them all.",
          'Also in Paris that autumn he played his most famous game, the "Opera Game", in a box at the Salle Ventadour while an opera was on stage, against the Duke of Brunswick and Count Isouard playing together. It is still used to teach rapid development.',
        ],
      },
      {
        heading: 'Leaving the game',
        body: [
          'Back home, Morphy soon withdrew from competitive chess and tried several times to set up as a lawyer, without success. He refused all invitations to return to the board, his mental health declined in his final years, and he died in New Orleans in 1884, aged 47.',
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
      "Tigran Petrosian was the hardest player of his generation to beat. Where Tal attacked, Petrosian prevented: he saw his opponent's plans coming and quietly made them impossible.",
    sections: [
      {
        heading: 'Hard beginnings',
        body: [
          "Petrosian was born in Tbilisi to Armenian parents. He was orphaned during the Second World War and had to sweep streets to get by. Chess became his refuge. He later said that Aron Nimzowitsch's book Chess Praxis had the greatest influence on him.",
        ],
      },
      {
        heading: 'World champion',
        body: [
          'He won the Soviet Championship four times, in 1959, 1961, 1969 and 1975. In 1963 he took the world title from Mikhail Botvinnik, winning 5 games, losing 2 and drawing 15. He defended it against Boris Spassky in 1966, then lost to Spassky in 1969.',
          'He studied philosophy at Yerevan State University, completing his thesis in 1968, and edited the chess newspaper 64.',
        ],
      },
      {
        heading: 'How he played',
        body: [
          "Petrosian's trademark was prophylaxis: improving his position while taking away his opponent's best ideas. He was famous for positional exchange sacrifices, giving a rook for a minor piece to gain lasting control. He could go through a whole tournament without losing a game, and his almost impenetrable defence earned him the nickname \"Iron Tigran\".",
        ],
      },
    ],
  },
}
