export type AdminResource = 'modules' | 'permissions' | 'roles' | 'customers' | 'platforms' | 'marketplaces'
export type FieldConfig = {
  key: string
  label: string
  type?: 'text' | 'email' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'image'
  required?: boolean
  optionsResource?: AdminResource
  optionLabel?: string
  optionValue?: string
}
export type ResourceConfig = {
  title: string
  singular: string
  icon: string
  columns: Array<{ key: string; label: string }>
  fields: FieldConfig[]
  defaults: Record<string, unknown>
}

export const resourceConfigs: Record<AdminResource, ResourceConfig> = {
  marketplaces: {
    title: 'Marketplaces',
    singular: 'Marketplace',
    icon: 'tabler-building-store',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'platform_name', label: 'Platform' },
      { key: 'code', label: 'Code' }, { key: 'country_code', label: 'Country' },
      { key: 'currency_code', label: 'Currency' }, { key: 'is_active', label: 'Status' }
    ],
    fields: [
      { key: 'platform', label: 'Platform', type: 'select', required: true, optionsResource: 'platforms' },
      { key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true },
      { key: 'country_code', label: 'Country code', required: true },
      { key: 'currency_code', label: 'Currency code', required: true },
      { key: 'external_marketplace_id', label: 'External marketplace ID', required: true },
      { key: 'region', label: 'Region' }, { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    defaults: { platform: '', name: '', code: '', country_code: '', currency_code: '', external_marketplace_id: '', region: '', is_active: true }
  },
  platforms: {
    title: 'Platforms',
    singular: 'Platform',
    icon: 'tabler-world-cog',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' },
      { key: 'description', label: 'Description' }, { key: 'logo_url', label: 'Logo' },
      { key: 'is_active', label: 'Status' }
    ],
    fields: [
      { key: 'name', label: 'Name', required: true }, { key: 'code', label: 'Code', required: true },
      { key: 'description', label: 'Description' }, { key: 'logo', label: 'Logo', type: 'image' },
      { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    defaults: { name: '', code: '', description: '', logo: null, is_active: true }
  },
  modules: {
    title: 'Modules',
    singular: 'Module',
    icon: 'tabler-box',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' },
      { key: 'sort_order', label: 'Order' }, { key: 'is_active', label: 'Status' }
    ],
    fields: [
      { key: 'name', label: 'Name', required: true }, { key: 'slug', label: 'Slug', required: true },
      { key: 'description', label: 'Description' }, { key: 'sort_order', label: 'Sort order', type: 'number' },
      { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    defaults: { name: '', slug: '', description: '', sort_order: 0, is_active: true }
  },
  permissions: {
    title: 'Permissions',
    singular: 'Permission',
    icon: 'tabler-key',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'codename', label: 'Codename' },
      { key: 'module_name', label: 'Module' }, { key: 'is_active', label: 'Status' }
    ],
    fields: [
      { key: 'module', label: 'Module', type: 'select', required: true, optionsResource: 'modules' },
      { key: 'name', label: 'Name', required: true }, { key: 'codename', label: 'Codename', required: true },
      { key: 'description', label: 'Description' }, { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    defaults: { module: '', name: '', codename: '', description: '', is_active: true }
  },
  roles: {
    title: 'Roles',
    singular: 'Role',
    icon: 'tabler-user-shield',
    columns: [
      { key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' },
      { key: 'permissions', label: 'Permissions' }, { key: 'is_active', label: 'Status' }
    ],
    fields: [
      { key: 'name', label: 'Name', required: true }, { key: 'slug', label: 'Slug', required: true },
      { key: 'description', label: 'Description' },
      { key: 'permissions', label: 'Permissions', type: 'multiselect', optionsResource: 'permissions', optionLabel: 'name', optionValue: 'codename' },
      { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    defaults: { name: '', slug: '', description: '', permissions: [], is_active: true }
  },
  customers: {
    title: 'Customers',
    singular: 'Customer',
    icon: 'tabler-users',
    columns: [
      { key: 'first_name', label: 'First name' }, { key: 'last_name', label: 'Last name' },
      { key: 'email', label: 'Email' }, { key: 'company', label: 'Company' },
      { key: 'has_login', label: 'Login' }, { key: 'is_active', label: 'Status' }
    ],
    fields: [
      { key: 'first_name', label: 'First name', required: true }, { key: 'last_name', label: 'Last name', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true }, { key: 'phone', label: 'Phone' },
      { key: 'company', label: 'Company' }, { key: 'address', label: 'Address' },
      { key: 'open_date', label: 'Open date', type: 'date' },
      { key: 'password', label: 'Login password' },
      { key: 'is_active', label: 'Active', type: 'boolean' }
    ],
    defaults: { first_name: '', last_name: '', email: '', phone: '', company: '', address: '', open_date: '', password: '', is_active: true }
  }
}
