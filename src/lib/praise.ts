const PRAISE = ['מצוין!', 'כל הכבוד!', 'מדהים!', 'וואו!', 'נכון מאוד!', 'את אלופה!', 'יופי!', 'בדיוק!'];
const COMFORT = ['כמעט!', 'לא נורא!', 'ננסה שוב בהמשך!'];

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
export const praise = () => pick(PRAISE);
export const comfort = () => pick(COMFORT);
