import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity as ActivityIcon, ArrowRight, CalendarClock, ChevronRight, CircleHelp,
  Clock3, Fan, Home, Lightbulb, LogOut, Plus, Power, Refrigerator, Settings2,
  Pencil, ShieldCheck, Sparkles, Tv, Wind, X, Zap,
} from 'lucide-react';
import {
  useCreateAutomation, useCreateDevice, useDeleteAutomation, useDeleteDevice,
  useGetDashboard, useGetMe, useListActivity, useListAutomations, useListDevices,
  useUpdateAutomation, useUpdateDevice, getGetDashboardQueryKey, getGetMeQueryKey,
  getListActivityQueryKey, getListAutomationsQueryKey, getListDevicesQueryKey,
} from '@workspace/api-client-react';
import type {
  Activity as ActivityRecord, Automation, AutomationInput, Device, DeviceInput,
  DashboardSummary,
} from '@workspace/api-client-react';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 25_000, refetchOnWindowFocus: false, retry: 1 } },
});
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const rooms = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Office'] as const;
const deviceTypes = ['light', 'fan', 'ac', 'tv', 'other'] as const;
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

function Logo({ dark = false }: { dark?: boolean }) {
  return <div className={`brand ${dark ? 'brand-dark' : ''}`} data-testid="brand-smart-home">
    <div className="brand-mark"><Home size={19} strokeWidth={2.3} /></div>
    <div><div className="brand-name">smart home</div><div className="brand-caption">A little more in sync</div></div>
  </div>;
}

function HomePage() {
  return <main className="landing">
    <nav className="landing-nav">
      <Logo dark />
      <div className="landing-actions">
        <Link href="/sign-in" className="landing-link" data-testid="link-sign-in">Sign in</Link>
        <Link href="/sign-up" className="button hero-button" data-testid="link-get-started">Get started <ArrowRight size={15} /></Link>
      </div>
    </nav>
    <div className="landing-main">
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="hero-kicker"><i /> Your home, all in one place</div>
          <h1>A calmer way<br />to <em>come home.</em></h1>
          <p>See what’s on, set the rhythm of your day, and keep every room feeling just right — without walking the whole house.</p>
          <div className="hero-actions">
            <Link href="/sign-up" className="button hero-button" data-testid="link-create-home">Create your home <ArrowRight size={15} /></Link>
            <Link href="/sign-in" className="landing-link" data-testid="link-returning-home">I have an account</Link>
          </div>
        </div>
        <div className="hero-art" aria-label="Illustration of a softly lit connected living room">
          <div className="house-scene">
            <div className="scene-sun" /><div className="scene-halo" /><div className="scene-window" />
            <div className="scene-floor" /><div className="scene-lamp" /><div className="scene-sofa" />
            <div className="scene-table" /><div className="scene-plant" />
          </div>
        </div>
      </section>
      <div className="landing-proof">
        <span className="proof-item"><ShieldCheck size={15} /> Your home stays yours</span>
        <span className="proof-item"><Clock3 size={15} /> Routines that run on time</span>
        <span className="proof-item"><Zap size={15} /> One clear view of every room</span>
      </div>
    </div>
    <footer className="landing-footer">
      <div className="footer-inner">
        <h2>Small comforts.<br />Better everyday rhythms.</h2>
        <p>Bring the lights, fans, climate and screens together in a home that feels ready when you are.</p>
      </div>
    </footer>
  </main>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== id) client.clear();
      prevUserIdRef.current = id;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#315f55',
    colorForeground: '#183d37',
    colorMutedForeground: '#70847b',
    colorDanger: '#ae5148',
    colorBackground: '#fbfaf4',
    colorInput: '#f5f2e9',
    colorInputForeground: '#183d37',
    colorNeutral: '#dedfd3',
    fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf4] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#183d37] font-bold tracking-tight',
    headerSubtitle: 'text-[#70847b]',
    socialButtonsBlockButtonText: 'text-[#183d37] font-semibold',
    formFieldLabel: 'text-[#274a42] font-semibold',
    footerActionLink: 'text-[#315f55] font-bold',
    footerActionText: 'text-[#70847b]',
    dividerText: 'text-[#70847b]',
    identityPreviewEditButton: 'text-[#315f55]',
    formFieldSuccessText: 'text-[#315f55]',
    alertText: 'text-[#98443f]',
    logoBox: 'rounded-xl',
    logoImage: 'rounded-lg',
    socialButtonsBlockButton: 'border-[#dedfd3] bg-[#f7f5ec] hover:bg-[#efeee4]',
    formButtonPrimary: 'bg-[#315f55] hover:bg-[#254e45] text-[#fbfaf4] font-bold',
    formFieldInput: 'border-[#dedfd3] bg-[#f7f5ec] text-[#183d37]',
    footerAction: 'border-t border-[#e7e5d8]',
    dividerLine: 'bg-[#dedfd3]',
    alert: 'bg-[#fbefeb] border-[#e8cbc4]',
    otpCodeFieldInput: 'border-[#dedfd3] bg-[#f7f5ec] text-[#183d37]',
    formFieldRow: 'gap-1.5',
    main: 'gap-5',
  },
};

function SignInPage() {
  return <div className="auth-screen">
    <aside className="auth-side"><Logo />
      <div className="auth-note"><h1>Your home,<br />right where<br />you left it.</h1><p>A familiar place to check the lights, tune the temperature, and set tomorrow in motion.</p></div>
      <div className="auth-side-foot">Thoughtful technology for the everyday.</div>
    </aside>
    <section className="auth-main"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></section>
  </div>;
}

function SignUpPage() {
  return <div className="auth-screen">
    <aside className="auth-side"><Logo />
      <div className="auth-note"><h1>Make room<br />for a little<br /><span>more ease.</span></h1><p>Bring your rooms and routines into one calm, clear view.</p></div>
      <div className="auth-side-foot">A better rhythm starts at home.</div>
    </aside>
    <section className="auth-main"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></section>
  </div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><HomePage /></Show></>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

const pageNames: Record<string, string> = {
  '/dashboard': 'Overview', '/devices': 'Devices & rooms', '/automations': 'Automations', '/activity': 'Activity',
};
const navItems = [
  { href: '/dashboard', title: 'Overview', Icon: Home },
  { href: '/devices', title: 'Devices & rooms', Icon: Zap },
  { href: '/automations', title: 'Automations', Icon: CalendarClock },
  { href: '/activity', title: 'Activity', Icon: ActivityIcon },
];

function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const profile = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = profile.data?.email || user?.primaryEmailAddress?.emailAddress || '';
  const name = profile.data?.displayName || user?.fullName || email.split('@')[0] || 'Homeowner';
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return <div className="app-shell">
    <aside className="sidebar">
      <Logo />
      <div className="nav-label">Your home</div>
      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ href, title, Icon }) => <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} data-testid={`nav-${href.slice(1)}`}>
          <Icon size={17} strokeWidth={1.8} />{title}
        </Link>)}
      </nav>
      <div className="side-bottom">
        <div className="home-status"><div className="status-top"><i className="online-dot" /> Home is in sync</div><p>Your devices are ready and routines are up to date.</p></div>
        <div className="profile-footer">
          <div className="avatar" data-testid="text-profile-avatar">{initials || 'H'}</div>
            <div><div className="profile-name" data-testid="text-profile-name">{profile.isLoading ? 'Loading profile' : name}</div>
              <div className="profile-email">{email || (profile.isError ? 'Profile unavailable' : 'Your home')}</div></div>
          <button className="signout" type="button" aria-label="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
    <div className="main-panel">
      <header className="topbar"><div className="breadcrumb">Smart home <ChevronRight size={13} style={{ verticalAlign: 'middle', margin: '0 4px' }} /> <strong>{pageNames[location] || 'Overview'}</strong></div>
        <div className="topbar-right"><span className="date-label">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><div className="avatar" aria-hidden="true">{initials || 'H'}</div></div>
      </header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ href, title, Icon }) => <Link key={href} href={href} className={location === href ? 'active' : ''} data-testid={`mobile-nav-${href.slice(1)}`}><Icon /><span>{title.split(' ')[0]}</span></Link>)}</nav>
  </div>;
}

function LoadingBlock({ title = 'Getting your home ready' }: { title?: string }) {
  return <div className="loading-state" role="status" data-testid="status-loading"><div style={{ width: 150, height: 14, marginBottom: 12 }} className="skeleton" /><div style={{ width: 230, height: 10 }} className="skeleton" /><p style={{ margin: '15px 0 0', fontSize: 11 }}>{title}</p></div>;
}

function ErrorBlock({ title = 'We couldn’t load this view', onRetry }: { title?: string; onRetry: () => void }) {
  return <div className="error-state" role="alert" data-testid="status-error"><CircleHelp size={24} /><h3>{title}</h3><p>Your home data is still safe. Try again in a moment.</p><button className="button secondary small" type="button" onClick={onRetry} data-testid="button-retry">Try again</button></div>;
}

function EmptyBlock({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="status-empty"><Sparkles size={23} /><h3>{title}</h3><p>{body}</p>{action}</div>;
}

function useRefreshRelated() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: getListDevicesQueryKey() });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getListActivityQueryKey() });
    void client.invalidateQueries({ queryKey: getListAutomationsQueryKey() });
  };
}

function deviceIcon(type: string) {
  if (type === 'light') return Lightbulb;
  if (type === 'fan') return Fan;
  if (type === 'ac') return Wind;
  if (type === 'tv') return Tv;
  return Refrigerator;
}

function timeAgo(value: string | null | undefined) {
  if (!value) return 'Not yet';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function DashboardPage() {
  const summary = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const devices = useListDevices(undefined, { query: { queryKey: getListDevicesQueryKey() } });
  const activity = useListActivity({ limit: 5 }, { query: { queryKey: getListActivityQueryKey({ limit: 5 }) } });
  const update = useUpdateDevice();
  const refreshRelated = useRefreshRelated();
  const [busyId, setBusyId] = useState<number | null>(null);
  const data = summary.data as DashboardSummary | undefined;
  const grouped = useMemo(() => rooms.map((room) => {
    const list = (devices.data || []).filter((device) => device.room === room);
    return { room, count: list.length, active: list.filter((device) => device.isOn).length };
  }).filter((entry) => entry.count), [devices.data]);

  function toggle(device: Device) {
    setBusyId(device.id);
    update.mutate({ id: device.id, data: { isOn: !device.isOn } }, { onSuccess: () => refreshRelated(), onSettled: () => setBusyId(null) });
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">A better day starts here</div><h1>Home overview</h1><p className="page-subtitle">Everything in its place, at a glance.</p></div>
      <Link href="/devices" className="button" data-testid="button-manage-devices">Manage devices <ArrowRight size={15} /></Link>
    </div>
    {summary.isLoading ? <div className="stat-grid">{[1, 2, 3, 4].map((n) => <div key={n} className="panel stat-card"><div className="skeleton" style={{ width: '50%', height: 11 }} /><div className="skeleton" style={{ width: '35%', height: 28, marginTop: 21 }} /></div>)}</div> : summary.isError ? <ErrorBlock onRetry={() => void summary.refetch()} /> : <>
      <section className="stat-grid" aria-label="Home summary">
        <StatCard icon={<Zap size={16} />} label="Connected devices" value={data?.totalDevices ?? 0} note={`${data?.activeDevices ?? 0} responding now`} testid="stat-total-devices" />
        <StatCard icon={<Power size={16} />} label="Switched on" value={data?.devicesOn ?? 0} note="Across every room" testid="stat-devices-on" />
        <StatCard icon={<Home size={16} />} label="Rooms" value={data?.rooms ?? 0} note="With devices connected" testid="stat-room-count" />
        <StatCard icon={<Zap size={16} />} label="Estimated energy" value={`${Number(data?.estimatedEnergyKwh || 0).toFixed(1)}`} suffix="kWh" note="Today · based on 4 hours per device" testid="stat-energy" />
      </section>
      <section className="overview-grid">
        <div className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Rooms at a glance</h2><p className="panel-note">A quick read on what’s happening around the house</p></div><Link href="/devices" className="text-link" data-testid="link-all-rooms">All rooms <ArrowRight size={13} /></Link></div>
          {devices.isLoading ? <LoadingBlock title="Loading rooms and device states" /> : devices.isError ? <div style={{ padding: '0 18px 18px' }}><ErrorBlock title="Room information unavailable" onRetry={() => void devices.refetch()} /></div> : grouped.length ? <div className="room-list">{grouped.map(({ room, count, active }) => <div className="room-row" key={room} data-testid={`room-summary-${room.toLowerCase().replaceAll(' ', '-')}`}>
            <div className="room-icon"><Home size={17} /></div><div><div className="room-name">{room}</div><div className="room-count">{count} device{count === 1 ? '' : 's'} · {active} on</div></div>
            <div className="room-energy">{active} / {count}<span>active devices</span></div></div>)}</div> : <div style={{ padding: '0 18px 18px' }}><EmptyBlock title="Your rooms are waiting" body="Add a device to start seeing each room take shape." action={<Link href="/devices" className="button small" data-testid="link-add-first-device">Add a device</Link>} /></div>}
        </div>
        <div className="panel">
          <div className="panel-heading"><div><h2 className="panel-title">Quick controls</h2><p className="panel-note">A few devices worth keeping close</p></div><Link href="/devices" className="text-link" data-testid="link-all-devices">See all <ArrowRight size={13} /></Link></div>
          <div className="quick-panel">{devices.isLoading ? <LoadingBlock title="Finding your devices" /> : devices.isError ? <ErrorBlock onRetry={() => void devices.refetch()} /> : devices.data?.length ? devices.data.slice(0, 4).map((device) => {
            const Icon = deviceIcon(device.type);
            return <div className="quick-device" key={device.id} data-testid={`quick-device-${device.id}`}><div className="device-icon"><Icon size={17} /></div><div><div className="device-title">{device.name}</div><div className="device-description">{device.room} · {device.isOn ? 'On' : 'Off'}</div></div>
              <button type="button" className={`switch ${device.isOn ? 'on' : ''}`} aria-label={`${device.isOn ? 'Turn off' : 'Turn on'} ${device.name}`} aria-pressed={device.isOn} disabled={update.isPending && busyId === device.id} onClick={() => toggle(device)} data-testid={`toggle-device-${device.id}`} /></div>;
          }) : <EmptyBlock title="No devices connected" body="Add a room device and control it from here." action={<Link href="/devices" className="button small" data-testid="link-connect-device">Connect device</Link>} />}</div>
        </div>
      </section>
      <section className="panel section-spacer">
        <div className="panel-heading"><div><h2 className="panel-title">Recent activity</h2><p className="panel-note">The latest changes around your home</p></div><Link href="/activity" className="text-link" data-testid="link-view-activity">View history <ArrowRight size={13} /></Link></div>
        {activity.isLoading ? <LoadingBlock title="Gathering recent changes" /> : activity.isError ? <div style={{ padding: '0 20px 18px' }}><ErrorBlock title="Recent activity unavailable" onRetry={() => void activity.refetch()} /></div> : activity.data?.length ? <div className="activity-list">{activity.data.map((entry) => <ActivityRow key={entry.id} item={entry} />)}</div> : <div style={{ padding: '0 20px 20px' }}><EmptyBlock title="No changes just yet" body="Device and routine updates will appear here." /></div>}
      </section>
    </>}
  </>;
}

function StatCard({ icon, label, value, suffix, note, testid }: { icon: ReactNode; label: string; value: ReactNode; suffix?: string; note: string; testid: string }) {
  return <div className="panel stat-card" data-testid={testid}><div className="stat-head"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}{suffix && <span style={{ fontSize: 12, marginLeft: 5, letterSpacing: 0 }}>{suffix}</span>}</div><div className="stat-foot">{note}</div></div>;
}

function ActivityRow({ item }: { item: ActivityRecord }) {
  return <div className="activity-row" data-testid={`activity-item-${item.id}`}><i className="activity-dot" /><div><div className="activity-message">{item.message}</div><div className="activity-meta">{[item.deviceName, item.room, timeAgo(item.createdAt)].filter(Boolean).join(' · ')}</div></div></div>;
}

function DeviceDialog({ editing, onClose, onSave, isPending, error }: { editing: Device | null; onClose: () => void; onSave: (data: DeviceInput) => void; isPending: boolean; error?: string }) {
  const [name, setName] = useState(editing?.name || '');
  const [type, setType] = useState<DeviceInput['type']>(editing?.type || 'light');
  const [room, setRoom] = useState<DeviceInput['room']>(editing?.room || 'Living Room');
  const [isOn, setIsOn] = useState(editing?.isOn || false);
  const [brightness, setBrightness] = useState(editing?.brightness ?? 70);
  const [fanSpeed, setFanSpeed] = useState(editing?.fanSpeed ?? 3);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ name: name.trim(), type, room, isOn, brightness: type === 'light' ? Number(brightness) : null, fanSpeed: type === 'fan' ? Number(fanSpeed) : null });
  }
  return <div className="form-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="form-dialog" onSubmit={submit} aria-labelledby="device-dialog-title" data-testid="form-device">
      <div className="dialog-head"><div><h2 id="device-dialog-title">{editing ? 'Edit device' : 'Add a device'}</h2><p>Keep the details clear and easy to recognize.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose} data-testid="button-close-device-form"><X size={17} /></button></div>
      <div className="form-grid">
        <div className="field full"><label htmlFor="device-name">Device name</label><input id="device-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Reading lamp" data-testid="input-device-name" /></div>
        <div className="field"><label htmlFor="device-type">Device type</label><select id="device-type" value={type} onChange={(event) => setType(event.target.value as DeviceInput['type'])} data-testid="select-device-type">{deviceTypes.map((item) => <option value={item} key={item}>{item === 'ac' ? 'Climate / AC' : item[0].toUpperCase() + item.slice(1)}</option>)}</select></div>
        <div className="field"><label htmlFor="device-room">Room</label><select id="device-room" value={room} onChange={(event) => setRoom(event.target.value as DeviceInput['room'])} data-testid="select-device-room">{rooms.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="field full"><label htmlFor="device-start-state">Initial state</label><select id="device-start-state" value={isOn ? 'on' : 'off'} onChange={(event) => setIsOn(event.target.value === 'on')} data-testid="select-device-state"><option value="off">Off</option><option value="on">On</option></select></div>
        {type === 'light' && <div className="field full"><label htmlFor="device-brightness">Brightness · {brightness}%</label><input id="device-brightness" type="range" min="0" max="100" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} data-testid="input-device-brightness" /></div>}
        {type === 'fan' && <div className="field full"><label htmlFor="device-fan-speed">Fan speed · {fanSpeed}</label><input id="device-fan-speed" type="range" min="1" max="5" value={fanSpeed} onChange={(event) => setFanSpeed(Number(event.target.value))} data-testid="input-device-fan-speed" /></div>}
      </div>
      {error && <p className="form-error" role="alert" data-testid="status-device-form-error">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} data-testid="button-cancel-device">Cancel</button><button type="submit" className="button" disabled={isPending} data-testid="button-save-device">{isPending ? 'Saving…' : editing ? 'Save changes' : 'Add device'}</button></div>
    </form>
  </div>;
}

function DevicesPage() {
  const devicesQuery = useListDevices(undefined, { query: { queryKey: getListDevicesQueryKey() } });
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const remove = useDeleteDevice();
  const refreshRelated = useRefreshRelated();
  const [filter, setFilter] = useState('All rooms');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [formError, setFormError] = useState('');
  const [pendingDeviceId, setPendingDeviceId] = useState<number | null>(null);
  const filteredDevices = (devicesQuery.data || []).filter((device) => filter === 'All rooms' || device.room === filter);
  function save(data: DeviceInput) {
    setFormError('');
    if (editing) update.mutate({ id: editing.id, data }, { onSuccess: () => { refreshRelated(); setDialogOpen(false); }, onError: () => setFormError('We couldn’t save this device. Please try again.') });
    else create.mutate({ data }, { onSuccess: () => { refreshRelated(); setDialogOpen(false); }, onError: () => setFormError('We couldn’t add this device. Please check the details and try again.') });
  }
  function toggle(device: Device) {
    setPendingDeviceId(device.id);
    update.mutate({ id: device.id, data: { isOn: !device.isOn } }, { onSuccess: refreshRelated, onSettled: () => setPendingDeviceId(null) });
  }
  function deleteOne(device: Device) {
    if (!window.confirm(`Remove ${device.name} from your home?`)) return;
    remove.mutate({ id: device.id }, { onSuccess: refreshRelated });
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Control every corner</div><h1>Devices & rooms</h1><p className="page-subtitle">A practical view of what’s connected and where it lives.</p></div>
      <button className="button" type="button" onClick={() => { setEditing(null); setFormError(''); setDialogOpen(true); }} data-testid="button-add-device"><Plus size={16} /> Add device</button></div>
    <div className="panel">
      <div className="panel-heading"><div><h2 className="panel-title">Your devices</h2><p className="panel-note">{devicesQuery.data?.length ?? 0} connected · Changes apply straight away</p></div><Settings2 size={17} color="hsl(var(--muted-foreground))" /></div>
      <div className="filter-bar">{['All rooms', ...rooms].map((item) => <button type="button" key={item} className={`filter-chip ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)} data-testid={`filter-room-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}</div>
      <div style={{ padding: '0 18px 20px' }}>
        {devicesQuery.isLoading ? <LoadingBlock title="Loading your connected devices" /> : devicesQuery.isError ? <ErrorBlock onRetry={() => void devicesQuery.refetch()} /> : filteredDevices.length ? <div className="devices-grid">{filteredDevices.map((device) => {
          const Icon = deviceIcon(device.type);
          return <article className="panel device-card" key={device.id} data-testid={`device-card-${device.id}`}>
            <div className="device-card-top"><div className="device-icon"><Icon size={19} /></div><span className={`device-status ${device.isOn ? 'active' : ''}`}>{device.isOn ? 'On' : 'Off'}</span></div>
            <h3>{device.name}</h3><div className="device-card-location">{device.room} · {device.type === 'ac' ? 'Climate' : device.type[0].toUpperCase() + device.type.slice(1)}</div>
            <div className="device-card-bottom"><span className="device-control-note">{device.type === 'light' && device.brightness !== null ? `${device.brightness}% brightness` : device.type === 'fan' && device.fanSpeed !== null ? `Speed ${device.fanSpeed} of 5` : `Updated ${timeAgo(device.lastUpdatedAt)}`}</span>
              <div className="tiny-actions"><button type="button" className="icon-button" aria-label={`Edit ${device.name}`} onClick={() => { setEditing(device); setFormError(''); setDialogOpen(true); }} data-testid={`button-edit-device-${device.id}`}><Settings2 size={15} /></button><button type="button" className="icon-button" aria-label={`Remove ${device.name}`} onClick={() => deleteOne(device)} data-testid={`button-delete-device-${device.id}`}><X size={15} /></button><button type="button" className={`switch ${device.isOn ? 'on' : ''}`} aria-label={`${device.isOn ? 'Turn off' : 'Turn on'} ${device.name}`} aria-pressed={device.isOn} disabled={update.isPending && pendingDeviceId === device.id} onClick={() => toggle(device)} data-testid={`toggle-device-${device.id}`} /></div>
            </div>
          </article>;
        })}</div> : <EmptyBlock title={filter === 'All rooms' ? 'A good place to start' : `Nothing in ${filter} yet`} body={filter === 'All rooms' ? 'Add a device to begin bringing your rooms together.' : 'Choose another room or add a device here.'} action={<button className="button small" type="button" onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="button-empty-add-device"><Plus size={14} /> Add a device</button>} />}
      </div>
    </div>
    {(create.isError || update.isError || remove.isError) && <div className="toast-note" role="alert" data-testid="status-device-mutation-error">That change didn’t go through. Please try again.</div>}
    {dialogOpen && <DeviceDialog key={editing?.id || 'new'} editing={editing} onClose={() => setDialogOpen(false)} onSave={save} isPending={create.isPending || update.isPending} error={formError} />}
  </>;
}

function AutomationDialog({ editing, devices, onClose, onSave, isPending, error }: { editing: Automation | null; devices: Device[]; onClose: () => void; onSave: (data: AutomationInput) => void; isPending: boolean; error?: string }) {
  const [name, setName] = useState(editing?.name || '');
  const [targetKind, setTargetKind] = useState<AutomationInput['targetKind']>(editing?.targetKind || 'device');
  const [targetDeviceId, setTargetDeviceId] = useState(editing?.targetDeviceId ?? devices[0]?.id ?? 0);
  const [time, setTime] = useState(editing?.time || '07:00');
  const [days, setDays] = useState<string[]>(editing?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [action, setAction] = useState<AutomationInput['action']>(editing?.action || 'on');
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave({ name: name.trim(), targetKind, targetDeviceId: targetKind === 'device' ? Number(targetDeviceId) : null, time, days: days as AutomationInput['days'], action, enabled: true });
  }
  function toggleDay(day: string) { setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]); }
  return <div className="form-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="form-dialog" onSubmit={submit} data-testid="form-automation">
      <div className="dialog-head"><div><h2 id="automation-dialog-title">{editing ? 'Edit routine' : 'Schedule a routine'}</h2><p>Choose a time, days, and what should happen.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose} data-testid="button-close-automation-form"><X size={17} /></button></div>
      <div className="form-grid">
        <div className="field full"><label htmlFor="automation-name">Routine name</label><input id="automation-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekday morning" data-testid="input-automation-name" /></div>
        <div className="field"><label htmlFor="automation-target-kind">Apply to</label><select id="automation-target-kind" value={targetKind} onChange={(event) => setTargetKind(event.target.value as AutomationInput['targetKind'])} data-testid="select-automation-target"><option value="device">One device</option><option value="all_lights">All lights</option></select></div>
        {targetKind === 'device' && <div className="field"><label htmlFor="automation-device">Device</label><select id="automation-device" value={targetDeviceId} onChange={(event) => setTargetDeviceId(Number(event.target.value))} required data-testid="select-automation-device">{devices.map((device) => <option value={device.id} key={device.id}>{device.name} · {device.room}</option>)}</select></div>}
        <div className="field"><label htmlFor="automation-time">Time</label><input type="time" id="automation-time" required value={time} onChange={(event) => setTime(event.target.value)} data-testid="input-automation-time" /></div>
        <div className="field"><label htmlFor="automation-action">Action</label><select id="automation-action" value={action} onChange={(event) => setAction(event.target.value as AutomationInput['action'])} data-testid="select-automation-action"><option value="on">Turn on</option><option value="off">Turn off</option></select></div>
        <div className="field full"><label>Repeat on</label><div className="weekday-picker">{weekdays.map((day) => <label key={day}><input type="checkbox" checked={days.includes(day)} onChange={() => toggleDay(day)} data-testid={`checkbox-day-${day.toLowerCase()}`} /><span>{day[0]}</span></label>)}</div></div>
      </div>
      {!days.length && <p className="form-error" role="alert">Choose at least one day for this routine.</p>}
      {error && <p className="form-error" role="alert" data-testid="status-automation-form-error">{error}</p>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} data-testid="button-cancel-automation">Cancel</button><button type="submit" className="button" disabled={isPending || !days.length || (targetKind === 'device' && !devices.length)} data-testid="button-save-automation">{isPending ? 'Saving…' : editing ? 'Save changes' : 'Create routine'}</button></div>
    </form>
  </div>;
}

function automationTarget(item: Automation, devices: Device[]) {
  if (item.targetKind === 'all_lights') return 'All lights';
  return devices.find((device) => device.id === item.targetDeviceId)?.name || 'A device';
}

function AutomationsPage() {
  const automations = useListAutomations({ query: { queryKey: getListAutomationsQueryKey() } });
  const devices = useListDevices(undefined, { query: { queryKey: getListDevicesQueryKey() } });
  const create = useCreateAutomation();
  const update = useUpdateAutomation();
  const remove = useDeleteAutomation();
  const refreshRelated = useRefreshRelated();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);
  const [formError, setFormError] = useState('');
  function createOne(data: AutomationInput) {
    setFormError('');
    if (editing) {
      update.mutate({ id: editing.id, data }, {
        onSuccess: () => { refreshRelated(); setDialogOpen(false); setEditing(null); },
        onError: () => setFormError('We couldn’t update this routine. Check your selections and try again.'),
      });
    } else {
      create.mutate({ data }, {
        onSuccess: () => { refreshRelated(); setDialogOpen(false); },
        onError: () => setFormError('We couldn’t create this routine. Check your selections and try again.'),
      });
    }
  }
  function toggle(item: Automation) {
    update.mutate({ id: item.id, data: { enabled: !item.enabled } }, { onSuccess: refreshRelated });
  }
  function deleteOne(item: Automation) {
    if (!window.confirm(`Delete the “${item.name}” routine?`)) return;
    remove.mutate({ id: item.id }, { onSuccess: refreshRelated });
  }
  return <>
    <div className="page-heading"><div><div className="eyebrow">Set the pace of your day</div><h1>Automations</h1><p className="page-subtitle">Simple schedules that make the everyday feel effortless.</p></div>
      <button className="button" type="button" onClick={() => { setEditing(null); setFormError(''); setDialogOpen(true); }} data-testid="button-add-automation"><Plus size={16} /> New routine</button></div>
    <div className="overview-grid" style={{ alignItems: 'start' }}>
      <section className="automation-list" aria-label="Your routines">
        {automations.isLoading ? <LoadingBlock title="Loading scheduled routines" /> : automations.isError ? <ErrorBlock onRetry={() => void automations.refetch()} /> : automations.data?.length ? automations.data.map((item) => <AutomationCard item={item} devices={devices.data || []} key={item.id} onToggle={() => toggle(item)} onEdit={() => { setEditing(item); setFormError(''); setDialogOpen(true); }} onDelete={() => deleteOne(item)} pending={update.isPending || remove.isPending} />) : <EmptyBlock title="Give your day a rhythm" body="Create a routine to switch a device or all lights on a schedule that works for you." action={<button className="button small" type="button" onClick={() => { setEditing(null); setDialogOpen(true); }} data-testid="button-empty-add-automation"><Plus size={14} /> Schedule a routine</button>} />}
      </section>
      <aside className="panel">
        <div className="panel-heading"><div><h2 className="panel-title">Make it yours</h2><p className="panel-note">A little consistency goes a long way.</p></div><CalendarClock size={17} color="hsl(var(--primary))" /></div>
        <div className="quick-panel">
          <div className="activity-row"><i className="activity-dot" /><div><div className="activity-message">Morning welcome</div><div className="activity-meta">Lights on · weekdays</div></div></div>
          <div className="activity-row"><i className="activity-dot" /><div><div className="activity-message">A softer evening</div><div className="activity-meta">Turn lights off · nightly</div></div></div>
          <p className="panel-note" style={{ lineHeight: 1.7, margin: '14px 0 0' }}>Your routines run on your home’s local schedule. Pause or remove a routine whenever plans change.</p>
        </div>
      </aside>
    </div>
    {(create.isError || update.isError || remove.isError) && <div className="toast-note" role="alert" data-testid="status-automation-mutation-error">That routine couldn’t be updated. Please try again.</div>}
    {dialogOpen && <AutomationDialog key={editing?.id || 'new'} editing={editing} devices={devices.data || []} onClose={() => { setDialogOpen(false); setEditing(null); }} onSave={createOne} isPending={create.isPending || update.isPending} error={formError} />}
  </>;
}

function AutomationCard({ item, devices, onToggle, onEdit, onDelete, pending }: { item: Automation; devices: Device[]; onToggle: () => void; onEdit: () => void; onDelete: () => void; pending: boolean }) {
  const [hour, minute] = item.time.split(':').map(Number);
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, hour, minute));
  const daysLabel = item.days.length === 7 ? 'Every day' : item.days.join(' · ');
  return <article className="panel automation-card" data-testid={`automation-card-${item.id}`}>
    <div className="time-block">{time}<span>{daysLabel}</span></div>
    <div className="automation-content"><h3>{item.name}</h3><div className="automation-detail">{item.action === 'on' ? 'Turn on' : 'Turn off'} · {automationTarget(item, devices)} · Last ran {timeAgo(item.lastExecutedAt)}</div>
      <div className="day-list">{weekdays.map((day) => <span className={`day-pill ${item.days.includes(day) ? 'selected' : ''}`} key={day} title={day}>{day[0]}</span>)}</div>
    </div>
    <div className="automation-state"><span>{item.enabled ? 'Active' : 'Paused'}</span><button type="button" className={`switch ${item.enabled ? 'on' : ''}`} aria-label={`${item.enabled ? 'Pause' : 'Enable'} ${item.name}`} aria-pressed={item.enabled} disabled={pending} onClick={onToggle} data-testid={`toggle-automation-${item.id}`} /></div>
    <div className="tiny-actions"><button type="button" className="icon-button" aria-label={`Edit ${item.name}`} disabled={pending} onClick={onEdit} data-testid={`button-edit-automation-${item.id}`}><Pencil size={15} /></button><button type="button" className="icon-button" aria-label={`Delete ${item.name}`} disabled={pending} onClick={onDelete} data-testid={`button-delete-automation-${item.id}`}><X size={15} /></button></div>
  </article>;
}

function ActivityPage() {
  const activity = useListActivity({ limit: 100 }, { query: { queryKey: getListActivityQueryKey({ limit: 100 }) } });
  const items = activity.data || [];
  const grouped = useMemo(() => {
    const groups = new Map<string, ActivityRecord[]>();
    items.forEach((item) => {
      const key = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(item.createdAt));
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups.entries());
  }, [items]);
  return <>
    <div className="page-heading"><div><div className="eyebrow">A clear record of change</div><h1>Activity</h1><p className="page-subtitle">A timeline of device controls and scheduled routines.</p></div></div>
    {activity.isLoading ? <LoadingBlock title="Loading your home history" /> : activity.isError ? <ErrorBlock onRetry={() => void activity.refetch()} /> : items.length ? <section className="panel activity-page-list" data-testid="activity-history">
      {grouped.map(([day, dayItems]) => <div key={day}><div className="activity-day">{day}</div>{dayItems.map((item) => <ActivityRow key={item.id} item={item} />)}</div>)}
    </section> : <EmptyBlock title="A fresh start" body="When devices change or a routine runs, you’ll find the details here." />}
  </>;
}

function AppRouter() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to return to your home.' } },
      signUp: { start: { title: 'Make a home for it all', subtitle: 'Create an account to bring your rooms together.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <ClerkQueryClientCacheInvalidator />
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard"><Protected><AppLayout><DashboardPage /></AppLayout></Protected></Route>
      <Route path="/devices"><Protected><AppLayout><DevicesPage /></AppLayout></Protected></Route>
      <Route path="/automations"><Protected><AppLayout><AutomationsPage /></AppLayout></Protected></Route>
      <Route path="/activity"><Protected><AppLayout><ActivityPage /></AppLayout></Protected></Route>
      <Route><div className="min-h-[100dvh] grid place-items-center p-6"><div className="panel p-8 text-center"><h1>Page not found</h1><p className="page-subtitle">That address isn’t part of your home.</p><Link href="/" className="button" data-testid="link-not-found-home">Return home</Link></div></div></Route>
    </Switch>
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <WouterRouter base={basePath}>
      <AppRouter />
    </WouterRouter>
  </QueryClientProvider>;
}

export default App;
