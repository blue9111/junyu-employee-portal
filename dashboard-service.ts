import type {Firestore} from 'firebase-admin/firestore';
import type {Employee} from './employee-identity';

export type Mood='fire'|'great'|'okay'|'meh'|'struggling';
export type ChatMessage={id:string;authorEmail:string;authorName:string;text:string;createdAt:string};
export type Activity={id:string;actorEmail:string;actorName:string;kind:'task'|'mood'|'chat';text:string;createdAt:string};

const moodValues:Mood[]=['fire','great','okay','meh','struggling'];
const clean=(value:unknown,max:number)=>{
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)throw new Error('內容不可空白，且請勿超過字數限制。');
  return value.trim();
};
const taipeiDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());

export async function listDashboard(db:Firestore){
  const date=taipeiDate();
  const [moods,chats,activities]=await Promise.all([
    db.collection('employee_mood_checkins').where('date','==',date).get(),
    db.collection('employee_chat_messages').orderBy('createdAt','desc').limit(40).get(),
    db.collection('employee_activity_feed').orderBy('createdAt','desc').limit(30).get(),
  ]);
  const moodCounts=Object.fromEntries(moodValues.map(mood=>[mood,0])) as Record<Mood,number>;
  moods.docs.forEach(doc=>{const mood=doc.data().mood as Mood;if(moodValues.includes(mood))moodCounts[mood]++;});
  return {
    date,
    moodCounts,
    checkins:moods.docs.length,
    chats:chats.docs.map(doc=>({...doc.data(),id:doc.id}) as ChatMessage).reverse(),
    activities:activities.docs.map(doc=>({...doc.data(),id:doc.id}) as Activity),
  };
}

export async function checkInMood(db:Firestore,actor:Employee,mood:unknown){
  if(!moodValues.includes(mood as Mood))throw new Error('請選擇有效的心情。');
  const date=taipeiDate();
  const ref=db.collection('employee_mood_checkins').doc(`${date}_${actor.email}`);
  const previous=await ref.get();
  await ref.set({date,mood,employeeEmail:actor.email,employeeName:actor.name,updatedAt:new Date().toISOString()});
  if(!previous.exists)await addActivity(db,actor,'mood','完成今天的團隊心情報到');
}

export async function sendChat(db:Firestore,actor:Employee,input:unknown){
  const text=clean(input,300);const ref=db.collection('employee_chat_messages').doc();
  const message:ChatMessage={id:ref.id,authorEmail:actor.email,authorName:actor.name,text,createdAt:new Date().toISOString()};
  await ref.create(message);await addActivity(db,actor,'chat','在員工聊天室分享了一則訊息');return message;
}

export async function addActivity(db:Firestore,actor:Employee,kind:Activity['kind'],text:string){
  const ref=db.collection('employee_activity_feed').doc();
  const activity:Activity={id:ref.id,actorEmail:actor.email,actorName:actor.name,kind,text,createdAt:new Date().toISOString()};
  await ref.create(activity);return activity;
}
