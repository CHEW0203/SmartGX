export interface MockSmartGXUser {
  id: string;
  name: string;
  contact: string;
  gxHealth: number;
  smartScore: number;
  streak: number;
}

export const MOCK_SMARTGX_USERS: MockSmartGXUser[] = [
  { id: "u-aina", name: "Aina Rahman", contact: "0123456789", gxHealth: 78, smartScore: 640, streak: 9 },
  { id: "u-daniel", name: "Daniel Wong", contact: "01123456789", gxHealth: 73, smartScore: 602, streak: 7 },
  { id: "u-iman", name: "Nur Iman", contact: "+60199887766", gxHealth: 81, smartScore: 691, streak: 12 },
  { id: "u-lee", name: "Lee Wei Ming", contact: "0167788990", gxHealth: 69, smartScore: 560, streak: 5 },
  { id: "u-chloe", name: "Chloe Tan", contact: "0182233445", gxHealth: 76, smartScore: 625, streak: 8 },
];

