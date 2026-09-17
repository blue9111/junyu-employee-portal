import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import {createServer as createViteServer} from 'vite';
import {applicationDefault,initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {resolveEmployee,type Employee} from './employee-identity';
import {createTask,listTasks,TaskError,updateTask} from './task-service';
import {checkInMood,listChatPeople,listDashboard,listDirectMessages,sendChat,sendDirectMessage} from './dashboard-service';

dotenv.config();
const app=express();app.use(express.json({limit:'64kb'}));
const projectId=process.env.FIREBASE_PROJECT_ID||process.env.GOOGLE_CLOUD_PROJECT;
const firebase=projectId?initializeApp({credential:applicationDefault(),projectId}):null;
const db=firebase?getFirestore(firebase):null;
const auth=firebase?getAuth(firebase):null;

async function userFrom(req:express.Request):Promise<(Employee&{departmentCode?:string;unit?:string;jobTitle?:string})|null>{
  const token=/^Bearer (.+)$/.exec(req.header('authorization')||'')?.[1];
  if(!token||!auth||!db)return null;
  try{
    const identity=await auth.verifyIdToken(token,true);const employee=await resolveEmployee(db,identity);if(!employee)return null;
    const profile=employee.employeeId?(await db.collection('company_employee_directory').doc(employee.employeeId).get()).data():null;
    if(profile&&profile.active===false)return null;
    return {...employee,departmentCode:profile?.departmentCode||'',unit:profile?.unit||'',jobTitle:profile?.jobTitle||''};
  }catch{return null;}
}

app.get('/api/health',async(_req,res)=>{res.set('Cache-Control','no-store');if(!db)return res.json({ready:false});try{await db.collection('company_employee_directory').limit(1).get();res.json({ready:true});}catch{res.json({ready:false});}});
app.get('/api/firebase-config',(_req,res)=>{res.set('Cache-Control','no-store');res.json({apiKey:process.env.VITE_FIREBASE_API_KEY||'',authDomain:process.env.VITE_FIREBASE_AUTH_DOMAIN||'',projectId:process.env.VITE_FIREBASE_PROJECT_ID||process.env.FIREBASE_PROJECT_ID||'',appId:process.env.VITE_FIREBASE_APP_ID||''});});
app.get('/api/me',async(req,res)=>{res.set('Cache-Control','no-store');const employee=await userFrom(req);if(!employee)return res.status(403).json({error:'請使用已建檔且啟用的 Google 帳號登入。'});res.json({employee,canManageEmployees:employee.email==='jet@gotofunapp.com'});});
app.use('/api/tasks',async(req,res,next)=>{res.set('Cache-Control','no-store');if(!db)return res.status(503).json({error:'工作資料庫尚未連線。'});const employee=await userFrom(req);if(!employee)return res.status(403).json({error:'請使用已建檔且啟用的 Google 帳號登入。'});res.locals.employee=employee;next();});
app.get('/api/tasks',async(_req,res)=>{try{res.json({tasks:await listTasks(db!,res.locals.employee)});}catch{res.status(503).json({error:'讀取工作失敗。'});}});
app.post('/api/tasks',async(req,res)=>{try{res.status(201).json({task:await createTask(db!,res.locals.employee,req.body)});}catch(error){res.status(error instanceof TaskError?error.status:503).json({error:error instanceof TaskError?error.message:'新增工作失敗。'});}});
app.patch('/api/tasks/:id',async(req,res)=>{try{res.json({task:await updateTask(db!,res.locals.employee,req.params.id,req.body)});}catch(error){res.status(error instanceof TaskError?error.status:503).json({error:error instanceof TaskError?error.message:'更新工作失敗。'});}});
app.use('/api/dashboard',async(req,res,next)=>{res.set('Cache-Control','no-store');if(!db)return res.status(503).json({error:'工作資料庫尚未連線。'});const employee=await userFrom(req);if(!employee)return res.status(403).json({error:'請使用已建檔且啟用的 Google 帳號登入。'});res.locals.employee=employee;next();});
app.get('/api/dashboard',async(_req,res)=>{try{res.json(await listDashboard(db!));}catch{res.status(503).json({error:'讀取團隊工作台失敗。'});}});
app.post('/api/dashboard/mood',async(req,res)=>{try{await checkInMood(db!,res.locals.employee,req.body?.mood);res.status(201).json(await listDashboard(db!));}catch(error){res.status(400).json({error:error instanceof Error?error.message:'心情報到失敗。'});}});
app.post('/api/dashboard/chat',async(req,res)=>{try{await sendChat(db!,res.locals.employee,req.body?.text);res.status(201).json(await listDashboard(db!));}catch(error){res.status(400).json({error:error instanceof Error?error.message:'訊息傳送失敗。'});}});
app.get('/api/dashboard/people',async(_req,res)=>{try{res.json({people:await listChatPeople(db!,res.locals.employee)});}catch{res.status(503).json({error:'讀取公司人員失敗。'});}});
app.get('/api/dashboard/direct/:email',async(req,res)=>{try{res.json({messages:await listDirectMessages(db!,res.locals.employee,req.params.email)});}catch(error){res.status(400).json({error:error instanceof Error?error.message:'讀取私訊失敗。'});}});
app.post('/api/dashboard/direct/:email',async(req,res)=>{try{res.status(201).json({message:await sendDirectMessage(db!,res.locals.employee,req.params.email,req.body?.text)});}catch(error){res.status(400).json({error:error instanceof Error?error.message:'私訊傳送失敗。'});}});

async function start(){if(process.env.NODE_ENV!=='production'){const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{const dist=path.join(process.cwd(),'dist');app.use(express.static(dist));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));}app.listen(Number(process.env.PORT)||3000,'0.0.0.0');}
start();
