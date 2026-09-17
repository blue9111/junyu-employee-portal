import type {Firestore} from 'firebase-admin/firestore';
import type {Employee} from './employee-identity';

export type TaskStatus='todo'|'doing'|'done';
export type TaskPriority='low'|'normal'|'high';
export type Task={id:string;title:string;notes:string;dueDate:string;priority:TaskPriority;status:TaskStatus;ownerEmail:string;ownerName:string;createdAt:string;updatedAt:string;version:number};

export class TaskError extends Error{constructor(message:string,public status=400){super(message);}}
const clean=(value:unknown,max:number,required=false)=>{
  if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim()))throw new TaskError('請確認必填欄位與字數限制。');
  return value.trim();
};
const validDate=(value:unknown)=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export async function listTasks(db:Firestore,actor:Employee){
  const snapshot=await db.collection('employee_work_tasks').where('ownerEmail','==',actor.email).get();
  return snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as Task).sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||a.dueDate.localeCompare(b.dueDate));
}

export async function createTask(db:Firestore,actor:Employee,input:any){
  if(!validDate(input?.dueDate))throw new TaskError('請選擇有效的到期日。');
  if(!['low','normal','high'].includes(input?.priority))throw new TaskError('請選擇優先程度。');
  const ref=db.collection('employee_work_tasks').doc();
  const now=new Date().toISOString();
  const task:Task={id:ref.id,title:clean(input.title,120,true),notes:clean(input.notes??'',1000),dueDate:input.dueDate,priority:input.priority,status:'todo',ownerEmail:actor.email,ownerName:actor.name,createdAt:now,updatedAt:now,version:1};
  await ref.create(task);return task;
}

export async function updateTask(db:Firestore,actor:Employee,id:string,input:any){
  if(!/^[\w-]{1,100}$/.test(id)||!Number.isInteger(input?.version))throw new TaskError('工作識別或版本無效。');
  const ref=db.collection('employee_work_tasks').doc(id);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)throw new TaskError('找不到這項工作。',404);
    const old=snap.data() as Task;
    if(old.ownerEmail!==actor.email)throw new TaskError('沒有這項工作的權限。',403);
    if(old.version!==input.version)throw new TaskError('工作已更新，請重新整理。',409);
    const status=input.status as TaskStatus;
    if(!['todo','doing','done'].includes(status))throw new TaskError('工作狀態無效。');
    const task={...old,status,updatedAt:new Date().toISOString(),version:old.version+1};
    tx.set(ref,task);return task;
  });
}
