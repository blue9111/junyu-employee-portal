import {useEffect,useMemo,useState} from 'react';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut,type Auth,type User} from 'firebase/auth';
import {Bell,BriefcaseBusiness,Building2,CalendarDays,Check,ChevronRight,Clock3,GripVertical,LogOut,Plus,Search,Settings,ShieldCheck,Sparkles,SunMedium,Users,X} from 'lucide-react';
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
    <header className="topbar"><div className="topbar-inner"><div className="app-brand"><span>J</span><div><b>君宇 Nexus</b><small>Employee Workspace</small></div></div><div className="search"><Search/><input aria-label="搜尋工作" placeholder="搜尋人員、任務與服務…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="theme-switch"><button className="active"><SunMedium/>淺色</button><button><Sparkles/>系統</button></div><button className="notice" title="通知"><Bell/></button><div className="user-menu"><div className="avatar">{employee.name.slice(0,1)}</div><span><b>{employee.name}</b><small>{employee.jobTitle||'員工'}</small></span><button title="登出" onClick={()=>auth&&signOut(auth)}><LogOut/></button></div></div></header>
    <main className="portal-main"><div className="page-content">
      <section className="welcome"><div><p>早安</p><h1>{employee.name} <span>👋</span></h1><div>這是您的團隊概況與個人工作台，今天也一起完成重要工作。</div></div><button className="hero-action" onClick={()=>setModal(true)}><Plus/>建立工作</button></section>
      <div className="dashboard-heading"><div><h2>工作總覽</h2><p>今天的工作、行程與公司服務一覽</p></div><span><GripVertical/> 卡片式工作台</span></div>
      <section className="dashboard-grid">
        <article className="panel stats-card"><div className="card-title"><span className="icon-box blue"><BriefcaseBusiness/></span><h3>我的統計</h3></div><div className="mini-stats"><div className="blue"><BriefcaseBusiness/><strong>{tasks.length}</strong><span>全部工作</span></div><div className="amber"><Clock3/><strong>{counts.doing}</strong><span>進行中</span></div><div className="green"><Check/><strong>{completion}%</strong><span>完成率</span></div></div></article>
        <article className="panel schedule-card"><div className="card-title"><span className="icon-box amber"><CalendarDays/></span><h3>今日行程</h3><small>會議服務維護中</small></div><div className="schedule-list"><div className="blue"><b>工作規劃</b><span>09:00</span></div><div className="amber"><b>進度確認</b><span>14:00</span></div><div className="rose"><b>每日整理</b><span>16:30</span></div></div></article>
        <article className="panel tasks-card"><div className="card-title"><span className="icon-box green"><Check/></span><h3>我的任務</h3><button onClick={()=>setModal(true)}><Plus/></button></div>{visible.length?<div className="compact-tasks">{visible.slice(0,3).map(task=><button key={task.id} className={`compact-task ${task.status}`} disabled={busy} onClick={()=>void advance(task)}><span className="task-check">{task.status==='done'?<Check/>:task.status==='doing'?<Clock3/>:null}</span><b>{task.title}</b><i className={task.priority}/></button>)}<small>{counts.done}/{tasks.length} 已完成</small></div>:<button className="empty-compact" onClick={()=>setModal(true)}><Plus/><b>建立第一項工作</b><span>工作會與您的帳號同步</span></button>}</article>
        <article className="panel quick-card"><div className="card-title"><span className="icon-box violet"><Sparkles/></span><h3>快速操作</h3></div><div className="quick-list"><button onClick={()=>setModal(true)}><span className="blue"><Plus/></span><b>建立工作<small>新增個人待辦事項</small></b></button><button disabled><span className="amber"><CalendarDays/></span><b>會議預約<small>服務目前維護中</small></b></button>{employee.email==='jet@gotofunapp.com'&&<a href="https://takeway-company.ai.studio/"><span className="green"><Settings/></span><b>人員管理<small>開啟公司名冊後台</small></b></a>}</div></article>
        <article className="panel profile-card"><div className="card-title"><span className="icon-box cyan"><Users/></span><h3>我的資料</h3></div><div className="profile-hero"><div className="avatar large">{employee.name.slice(0,1)}</div><div><b>{employee.name}</b><span>{employee.unit||'君宇集團'} · {employee.jobTitle||'員工'}</span></div></div><dl><div><dt>工號</dt><dd>{employee.employeeId||'未設定'}</dd></div><div><dt>部門代碼</dt><dd>{employee.departmentCode||'未設定'}</dd></div><div><dt>Google 帳號</dt><dd>{employee.email}</dd></div></dl></article>
        <article className="panel news-card"><div className="card-title"><span className="icon-box rose"><Building2/></span><h3>公司服務</h3></div><div className="news-list"><div><span/><b>員工工作入口已啟用</b><small>個人名冊與任務已同步</small></div><div><span/><b>會議預約系統</b><small>連結維護完成後開放</small></div><div><span/><b>Nexus 工作台</b><small>{message}</small></div></div></article>
      </section>
      <section className="panel full-tasks"><div className="panel-head"><div><p className="eyebrow">MY WORK</p><h2>全部任務</h2></div><button className="text-button" onClick={()=>setModal(true)}><Plus/>新增工作</button></div>{visible.length?<div className="task-list">{visible.slice(0,8).map(task=><button key={task.id} className={`task-row ${task.status}`} disabled={busy} onClick={()=>void advance(task)}><span className="task-check">{task.status==='done'?<Check/>:task.status==='doing'?<Clock3/>:null}</span><span className="task-copy"><b>{task.title}</b><small>{task.notes||'沒有補充說明'} · 到期 {task.dueDate}</small></span><span className={`priority ${task.priority}`}>{task.priority==='high'?'高':task.priority==='low'?'低':'一般'}</span><span className="task-status">{statusLabel[task.status]}</span></button>)}</div>:<div className="empty"><BriefcaseBusiness/><h3>目前沒有工作</h3><p>按「建立工作」新增第一項實際任務。</p></div>}</section>
    </div></main>
    {modal&&<div className="modal-backdrop"><form className="task-modal" onSubmit={createTask}><div className="modal-head"><div><p className="eyebrow">NEW TASK</p><h2>建立工作</h2></div><button type="button" aria-label="關閉" onClick={()=>setModal(false)}><X/></button></div><label>工作名稱<input autoFocus required maxLength={120} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="例如：完成設備盤點"/></label><label>補充說明<textarea maxLength={1000} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="工作內容、交付標準或備註"/></label><div className="form-row"><label>到期日<input required type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></label><label>優先程度<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Task['priority']})}><option value="low">低</option><option value="normal">一般</option><option value="high">高</option></select></label></div><div className="modal-actions"><button type="button" onClick={()=>setModal(false)}>取消</button><button className="primary" disabled={busy}>{busy?'建立中…':'建立工作'}</button></div></form></div>}
  </div>;
}
