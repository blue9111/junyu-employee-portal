import {useEffect,useMemo,useState} from 'react';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,type Auth,type User} from 'firebase/auth';
import {BriefcaseBusiness,Building2,CalendarDays,Check,ChevronRight,Clock3,LayoutDashboard,LogOut,Menu,Plus,Search,Settings,ShieldCheck,Sparkles,SunMedium,Users,X} from 'lucide-react';
import {readJson} from './api';

type Employee={email:string;name:string;employeeId:string;departmentCode?:string;unit?:string;jobTitle?:string};
type TaskStatus='todo'|'doing'|'done';
type Task={id:string;title:string;notes:string;dueDate:string;priority:'low'|'normal'|'high';status:TaskStatus;version:number};
type NewTask={title:string;notes:string;dueDate:string;priority:Task['priority']};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());
const emptyTask=():NewTask=>({title:'',notes:'',dueDate:today(),priority:'normal'});
const statusLabel:Record<TaskStatus,string>={todo:'待處理',doing:'進行中',done:'已完成'};
const nextStatus:Record<TaskStatus,TaskStatus>={todo:'doing',doing:'done',done:'todo'};

export default function App(){
  const [auth,setAuth]=useState<Auth|null>(null);
  const [user,setUser]=useState<User|null>(null);
  const [employee,setEmployee]=useState<Employee|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [checking,setChecking]=useState(true);
  const [message,setMessage]=useState('正在連線員工工作入口…');
  const [query,setQuery]=useState('');
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState<NewTask>(emptyTask());
  const [busy,setBusy]=useState(false);
  const [menu,setMenu]=useState(false);

  async function api(path:string,method='GET',body?:unknown){
    if(!user)throw Error('請先登入。');
    const response=await fetch(path,{method,headers:{Authorization:`Bearer ${await user.getIdToken()}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    const data=await readJson(response);if(!response.ok)throw Error(data.error||'服務暫時無法使用。');return data;
  }
  async function loadTasks(){try{const data=await api('/api/tasks');setTasks(data.tasks);}catch(error){setMessage(error instanceof Error?error.message:'讀取工作失敗。');}}

  useEffect(()=>{void(async()=>{try{const response=await fetch('/api/firebase-config',{cache:'no-store'});const config=await response.json();if(!Object.values(config).every(Boolean))throw Error();setAuth(getAuth(initializeApp(config)));}catch{setMessage('Google 登入尚未設定。');setChecking(false);}})();},[]);
  useEffect(()=>{if(!auth)return;return onAuthStateChanged(auth,current=>{setUser(current);setEmployee(null);setTasks([]);setChecking(!!current);setMessage(current?'正在載入您的工作空間…':'請使用已建檔且啟用的 Google 帳號登入。');});},[auth]);
  useEffect(()=>{if(!user)return;void(async()=>{try{const response=await fetch('/api/me',{headers:{Authorization:`Bearer ${await user.getIdToken()}`}});const data=await readJson(response);if(!response.ok)throw Error(data.error);setEmployee(data.employee);setMessage('個人工作空間已同步');}catch(error){setMessage(error instanceof Error?error.message:'登入驗證失敗。');}finally{setChecking(false);}})();},[user]);
  useEffect(()=>{if(employee)void loadTasks();},[employee]);
  useEffect(()=>{if(!modal)return;const close=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)setModal(false)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[modal,busy]);

  const visible=useMemo(()=>tasks.filter(task=>`${task.title} ${task.notes}`.toLowerCase().includes(query.toLowerCase())),[tasks,query]);
  const counts={todo:tasks.filter(t=>t.status==='todo').length,doing:tasks.filter(t=>t.status==='doing').length,done:tasks.filter(t=>t.status==='done').length};
  const completion=tasks.length?Math.round(counts.done/tasks.length*100):0;

  async function login(){if(!auth)return;setMessage('正在開啟 Google 登入…');try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch{setMessage('Google 登入未完成，請重新嘗試。');}}
  async function createTask(event:React.FormEvent){event.preventDefault();setBusy(true);try{await api('/api/tasks','POST',form);setModal(false);setForm(emptyTask());setMessage('工作已建立並同步。');await loadTasks();}catch(error){setMessage(error instanceof Error?error.message:'新增工作失敗。');}finally{setBusy(false);}}
  async function advance(task:Task){setBusy(true);try{await api(`/api/tasks/${task.id}`,'PATCH',{version:task.version,status:nextStatus[task.status]});await loadTasks();}catch(error){setMessage(error instanceof Error?error.message:'更新工作失敗。');}finally{setBusy(false);}}

  if(!employee)return <div className="login-page"><div className="login-glow one"/><div className="login-glow two"/><section className="login-card"><div className="login-brand"><span>J</span><div><b>君宇集團</b><small>JUNYU GROUP</small></div></div><p className="eyebrow">NEXUS EMPLOYEE WORKSPACE</p><h1>員工工作入口</h1><p className="login-copy">將個人任務、會議與公司服務集中在一個現代化工作台。</p><div className="login-status"><ShieldCheck size={18}/>{message}</div>{!user?<button className="primary large" disabled={!auth||checking} onClick={login}>使用 Google 帳號登入<ChevronRight size={18}/></button>:!checking&&<button onClick={()=>auth&&signOut(auth)}>切換 Google 帳號</button>}<small className="login-note">僅限公司名冊中已建檔並啟用的帳號</small></section></div>;

  return <div className="portal-shell">
    <aside className={menu?'sidebar open':'sidebar'}><div className="side-brand"><span>J</span><div><b>君宇 Nexus</b><small>員工工作入口</small></div><button className="mobile-close" onClick={()=>setMenu(false)}><X/></button></div><nav><button className="active"><LayoutDashboard/>工作總覽</button><button><BriefcaseBusiness/>我的任務</button><button className="disabled"><CalendarDays/>會議預約<small>維護中</small></button><button><Users/>公司名錄</button>{employee.email==='jet@gotofunapp.com'&&<a href="https://takeway-company.ai.studio/"><Settings/>人員管理</a>}</nav><div className="side-footer"><Sparkles/><span>可安裝至手機與電腦<br/><small>Nexus PWA</small></span></div></aside>
    {menu&&<button className="mobile-overlay" aria-label="關閉選單" onClick={()=>setMenu(false)}/>} 
    <main className="portal-main">
      <header className="topbar"><button className="menu-button" onClick={()=>setMenu(true)}><Menu/></button><div className="search"><Search/><input aria-label="搜尋工作" placeholder="搜尋我的任務" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="user-menu"><div className="avatar">{employee.name.slice(0,1)}</div><span><b>{employee.name}</b><small>{employee.unit||'君宇集團'} · {employee.jobTitle||'員工'}</small></span><button title="登出" onClick={()=>auth&&signOut(auth)}><LogOut/></button></div></header>
      <div className="page-content"><section className="welcome"><div><p><SunMedium size={17}/> 今天也一起完成重要工作</p><h1>{employee.name}，您好</h1><span>這是您的個人工作空間，任務資料會與您的 Google 帳號同步。</span></div><button className="primary" onClick={()=>setModal(true)}><Plus/>建立工作</button></section>
      <div className="status-line"><span/><b>{message}</b><small>工號 {employee.employeeId||'未設定'} · {employee.departmentCode||'--'} {employee.unit||''}</small></div>
      <section className="stats-grid"><article><div className="stat-icon blue"><BriefcaseBusiness/></div><span>全部工作</span><strong>{tasks.length}</strong><small>個人工作總數</small></article><article><div className="stat-icon amber"><Clock3/></div><span>進行中</span><strong>{counts.doing}</strong><small>目前執行項目</small></article><article><div className="stat-icon green"><Check/></div><span>完成率</span><strong>{completion}%</strong><small>{counts.done} 項已完成</small></article></section>
      <section className="content-grid"><article className="panel tasks-panel"><div className="panel-head"><div><p className="eyebrow">MY WORK</p><h2>我的任務</h2></div><button className="text-button" onClick={()=>setModal(true)}><Plus/>新增</button></div>{visible.length?<div className="task-list">{visible.slice(0,8).map(task=><button key={task.id} className={`task-row ${task.status}`} disabled={busy} onClick={()=>void advance(task)}><span className="task-check">{task.status==='done'?<Check/>:task.status==='doing'?<Clock3/>:null}</span><span className="task-copy"><b>{task.title}</b><small>{task.notes||'沒有補充說明'} · 到期 {task.dueDate}</small></span><span className={`priority ${task.priority}`}>{task.priority==='high'?'高':task.priority==='low'?'低':'一般'}</span><span className="task-status">{statusLabel[task.status]}</span></button>)}</div>:<div className="empty"><BriefcaseBusiness/><h3>目前沒有工作</h3><p>按「建立工作」新增第一項實際任務。</p></div>}</article>
      <aside className="side-cards"><article className="panel service-card"><div className="service-icon meeting"><CalendarDays/></div><p className="eyebrow">SERVICE</p><h2>會議預約</h2><p>預約服務連結正在維護，恢復後會直接從這張卡片進入。</p><button disabled>維護中</button></article><article className="panel profile-card"><p className="eyebrow">MY PROFILE</p><h2>我的資料</h2><dl><div><dt>姓名</dt><dd>{employee.name}</dd></div><div><dt>工號</dt><dd>{employee.employeeId||'未設定'}</dd></div><div><dt>單位</dt><dd>{employee.unit||'未設定'}</dd></div><div><dt>職稱</dt><dd>{employee.jobTitle||'未設定'}</dd></div></dl></article></aside></section></div>
    </main>
    {modal&&<div className="modal-backdrop"><form className="task-modal" onSubmit={createTask}><div className="modal-head"><div><p className="eyebrow">NEW TASK</p><h2>建立工作</h2></div><button type="button" aria-label="關閉" onClick={()=>setModal(false)}><X/></button></div><label>工作名稱<input autoFocus required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：完成設備盤點"/></label><label>補充說明<textarea maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="工作內容、交付標準或備註"/></label><div className="form-row"><label>到期日<input required type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label><label>優先程度<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Task['priority']})}><option value="low">低</option><option value="normal">一般</option><option value="high">高</option></select></label></div><div className="modal-actions"><button type="button" onClick={()=>setModal(false)}>取消</button><button className="primary" disabled={busy}>{busy?'建立中…':'建立工作'}</button></div></form></div>}
  </div>;
}
