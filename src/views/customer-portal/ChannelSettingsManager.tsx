'use client'

import { useEffect, useState } from 'react'

import TabContext from '@mui/lab/TabContext'
import TabPanel from '@mui/lab/TabPanel'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import InputAdornment from '@mui/material/InputAdornment'
import Snackbar from '@mui/material/Snackbar'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'

import CustomTabList from '@core/components/mui/TabList'
import CustomTextField from '@core/components/mui/TextField'

type AmazonForm = {
  lwa_client_id: string
  lwa_client_secret: string
  spapi_application_id: string
  authorization_url: string
  oauth_callback_url: string
}
type EbayForm = {
  client_id: string
  client_secret: string
  redirect_uri: string
  authorization_url: string
  oauth_callback_url: string
  oauth_scopes: string
}
type ProviderState = { configured?: boolean; secret_configured?: boolean }

const amazonDefaults: AmazonForm = {
  lwa_client_id: '', lwa_client_secret: '', spapi_application_id: '',
  authorization_url: 'https://sellercentral-europe.amazon.com/apps/authorize/consent',
  oauth_callback_url: 'http://localhost:8000/api/v1/channels/amazon/callback/'
}
const ebayDefaults: EbayForm = {
  client_id: '', client_secret: '', redirect_uri: '', authorization_url: 'https://auth.ebay.com/oauth2/authorize',
  oauth_callback_url: 'http://localhost:8000/api/v1/channels/ebay/callback/',
  oauth_scopes: 'https://api.ebay.com/oauth/api_scope'
}

const readError = async (response: Response) => {
  const data = await response.json().catch(() => null)

  if (data?.detail) return String(data.detail)
  if (data && typeof data === 'object') return Object.entries(data)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ')

  return `Request failed (${response.status})`
}

const ChannelSettingsManager = () => {
  const [amazon, setAmazon] = useState<AmazonForm>(amazonDefaults)
  const [ebay, setEbay] = useState<EbayForm>(ebayDefaults)
  const [status, setStatus] = useState<{ amazon: ProviderState; ebay: ProviderState }>({ amazon: {}, ebay: {} })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [moduleTab, setModuleTab] = useState('channels')
  const [providerTab, setProviderTab] = useState('amazon')

  useEffect(() => {
    fetch('/api/portal/channel-settings').then(async response => {
      if (!response.ok) throw new Error(await readError(response))
      const data = await response.json()

      setStatus(data)
      setAmazon(current => ({
        ...current,
        lwa_client_id: data.amazon.lwa_client_id ?? '',
        spapi_application_id: data.amazon.spapi_application_id ?? '',
        authorization_url: data.amazon.authorization_url ?? current.authorization_url,
        oauth_callback_url: data.amazon.oauth_callback_url ?? current.oauth_callback_url,
        lwa_client_secret: ''
      }))
      setEbay(current => ({
        ...current,
        client_id: data.ebay.client_id ?? '',
        redirect_uri: data.ebay.redirect_uri ?? '',
        authorization_url: data.ebay.authorization_url ?? current.authorization_url,
        oauth_callback_url: data.ebay.oauth_callback_url ?? current.oauth_callback_url,
        oauth_scopes: data.ebay.oauth_scopes ?? current.oauth_scopes,
        client_secret: ''
      }))
    }).catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load channel settings'))
      .finally(() => setLoading(false))
  }, [])

  const save = async (provider: 'amazon' | 'ebay') => {
    const values = provider === 'amazon' ? amazon : ebay
    const payload = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''))

    setSaving(provider)
    setError('')
    try {
      const response = await fetch('/api/portal/channel-settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [provider]: payload })
      })

      if (!response.ok) throw new Error(await readError(response))
      const data = await response.json()

      setStatus(data)
      if (provider === 'amazon') setAmazon(current => ({ ...current, lwa_client_secret: '' }))
      else setEbay(current => ({ ...current, client_secret: '' }))
      setNotice(`${provider === 'amazon' ? 'Amazon' : 'eBay'} settings saved securely.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to save ${provider} settings`)
    } finally {
      setSaving('')
    }
  }

  const field = (provider: 'amazon' | 'ebay', key: string, label: string, options?: { secret?: boolean; helper?: string }) => {
    const values = provider === 'amazon' ? amazon : ebay
    const updateValue = (value: string) => {
      if (provider === 'amazon') setAmazon(current => ({ ...current, [key]: value }))
      else setEbay(current => ({ ...current, [key]: value }))
    }

    return <CustomTextField fullWidth type={options?.secret ? 'password' : 'text'} label={label} value={(values as unknown as Record<string, string>)[key] ?? ''} helperText={options?.helper} placeholder={options?.secret && status[provider].secret_configured ? 'Leave blank to keep existing secret' : undefined} onChange={event => updateValue(event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className={options?.secret ? 'tabler-lock' : 'tabler-key'} /></InputAdornment> } }} />
  }

  if (loading) return <Card><CardContent><Typography>Loading channel settings…</Typography></CardContent></Card>

  const modulePlaceholder = (title: string, description: string, icon: string) => <Card><CardContent className='flex flex-col items-center gap-3 p-12 text-center'><div className='flex items-center justify-center rounded-xl bg-actionHover text-secondary is-20 bs-20'><i className={`${icon} text-4xl`} /></div><Typography variant='h4'>{title}</Typography><Typography color='text.secondary' className='max-is-[560px]'>{description}</Typography><Chip variant='tonal' color='secondary' label='Ready for module settings' /></CardContent></Card>

  return <div className='flex flex-col gap-6'>
    <Card><CardContent className='flex flex-wrap items-center justify-between gap-5 p-7'><div><Typography variant='h3'>Application Settings</Typography><Typography color='text.secondary'>Manage customer-level configuration for every application module in one place.</Typography></div><div className='flex items-center justify-center rounded-xl bg-primaryLighter text-primary is-20 bs-20'><i className='tabler-settings-cog text-4xl' /></div></CardContent></Card>
    {error && <Alert severity='error'>{error}</Alert>}
    <TabContext value={moduleTab}>
      <Card><CardContent className='pb-0'><CustomTabList onChange={(_, value: string) => setModuleTab(value)} variant='scrollable' pill='true'>
        <Tab value='general' label='General' icon={<i className='tabler-adjustments' />} iconPosition='start' />
        <Tab value='channels' label='Channel integrations' icon={<i className='tabler-plug-connected' />} iconPosition='start' />
        <Tab value='notifications' label='Notifications' icon={<i className='tabler-bell' />} iconPosition='start' />
        <Tab value='security' label='Security' icon={<i className='tabler-shield-lock' />} iconPosition='start' />
      </CustomTabList></CardContent></Card>
      <TabPanel value='general' className='p-0'>{modulePlaceholder('General settings', 'This section is prepared for shared company defaults, localization, currency, and other application-wide preferences.', 'tabler-adjustments')}</TabPanel>
      <TabPanel value='notifications' className='p-0'>{modulePlaceholder('Notification settings', 'Email, workflow, and event notification preferences can be added here as their APIs become available.', 'tabler-bell')}</TabPanel>
      <TabPanel value='security' className='p-0'>{modulePlaceholder('Security settings', 'Customer security policies and module-specific access preferences can be managed from this section.', 'tabler-shield-lock')}</TabPanel>
      <TabPanel value='channels' className='p-0'>
        <div className='flex flex-col gap-6'>
          <Alert severity='info'>Provider secrets are sent only when saved, encrypted by Django, and never returned to this page. Callback URLs must also be registered in the respective provider console.</Alert>
          <TabContext value={providerTab}>
            <Card><CardContent className='pb-0'><CustomTabList onChange={(_, value: string) => setProviderTab(value)} variant='scrollable'>
              <Tab value='amazon' label='Amazon SP-API' icon={<i className='tabler-brand-amazon' />} iconPosition='start' />
              <Tab value='ebay' label='eBay API' icon={<i className='tabler-brand-ebay' />} iconPosition='start' />
            </CustomTabList></CardContent></Card>
            <TabPanel value='amazon' className='p-0'><Card><CardContent className='flex flex-col gap-5 p-6'>
              <div className='flex items-center justify-between'><div className='flex items-center gap-3'><div className='flex items-center justify-center rounded-lg bg-warningLightOpacity text-warning is-12 bs-12'><i className='tabler-brand-amazon text-2xl' /></div><div><Typography variant='h5'>Amazon SP-API</Typography><Typography variant='body2' color='text.secondary'>Login with Amazon application credentials</Typography></div></div><Chip size='small' color={status.amazon.configured ? 'success' : 'warning'} label={status.amazon.configured ? 'Configured' : 'Not configured'} /></div>
              <Grid container spacing={5}><Grid size={{ xs: 12, md: 6 }}>{field('amazon', 'lwa_client_id', 'LWA Client ID')}</Grid><Grid size={{ xs: 12, md: 6 }}>{field('amazon', 'lwa_client_secret', 'LWA Client Secret', { secret: true })}</Grid><Grid size={{ xs: 12 }}>{field('amazon', 'spapi_application_id', 'SP-API Application ID')}</Grid><Grid size={{ xs: 12 }}>{field('amazon', 'authorization_url', 'Authorization URL')}</Grid><Grid size={{ xs: 12 }}>{field('amazon', 'oauth_callback_url', 'OAuth Callback URL', { helper: 'Register this exact URL in Seller Central.' })}</Grid></Grid>
              <Button variant='contained' startIcon={<i className='tabler-device-floppy' />} disabled={Boolean(saving)} onClick={() => void save('amazon')}>{saving === 'amazon' ? 'Saving…' : 'Save Amazon Settings'}</Button>
            </CardContent></Card></TabPanel>
            <TabPanel value='ebay' className='p-0'><Card><CardContent className='flex flex-col gap-5 p-6'>
              <div className='flex items-center justify-between'><div className='flex items-center gap-3'><div className='flex items-center justify-center rounded-lg bg-infoLightOpacity text-info is-12 bs-12'><i className='tabler-brand-ebay text-2xl' /></div><div><Typography variant='h5'>eBay API</Typography><Typography variant='body2' color='text.secondary'>eBay OAuth application credentials</Typography></div></div><Chip size='small' color={status.ebay.configured ? 'success' : 'warning'} label={status.ebay.configured ? 'Configured' : 'Not configured'} /></div>
              <Grid container spacing={5}><Grid size={{ xs: 12, md: 6 }}>{field('ebay', 'client_id', 'Client ID (App ID)')}</Grid><Grid size={{ xs: 12, md: 6 }}>{field('ebay', 'client_secret', 'Client Secret (Cert ID)', { secret: true })}</Grid><Grid size={{ xs: 12 }}>{field('ebay', 'redirect_uri', 'Redirect URI (RuName)', { helper: 'Use the RuName generated by eBay, not a normal URL.' })}</Grid><Grid size={{ xs: 12 }}>{field('ebay', 'authorization_url', 'Authorization URL')}</Grid><Grid size={{ xs: 12 }}>{field('ebay', 'oauth_callback_url', 'OAuth Callback URL')}</Grid><Grid size={{ xs: 12 }}>{field('ebay', 'oauth_scopes', 'OAuth Scopes')}</Grid></Grid>
              <Button variant='contained' startIcon={<i className='tabler-device-floppy' />} disabled={Boolean(saving)} onClick={() => void save('ebay')}>{saving === 'ebay' ? 'Saving…' : 'Save eBay Settings'}</Button>
            </CardContent></Card></TabPanel>
          </TabContext>
        </div>
      </TabPanel>
    </TabContext>
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </div>
}

export default ChannelSettingsManager
