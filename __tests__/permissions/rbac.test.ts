import { describe, it, expect } from 'vitest'
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from '@/lib/permissions/catalog'

describe('RBAC catalog', () => {
  it('OWNER is a superset of every other role', () => {
    const owner = new Set(DEFAULT_ROLE_PERMISSIONS.OWNER)
    for (const role of ['ADMIN', 'MANAGER', 'STAFF', 'VIEWER'] as const) {
      for (const perm of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(owner.has(perm), `OWNER should include ${perm} (granted to ${role})`).toBe(true)
      }
    }
  })

  it('VIEWER has no create/update/delete/manage permissions', () => {
    for (const perm of DEFAULT_ROLE_PERMISSIONS.VIEWER) {
      expect(perm.endsWith('.create')).toBe(false)
      expect(perm.endsWith('.update')).toBe(false)
      expect(perm.endsWith('.delete')).toBe(false)
      expect(perm.endsWith('.manage')).toBe(false)
    }
  })

  it('every permission constant maps to a unique dotted key', () => {
    const values = Object.values(PERMISSIONS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('ADMIN has every permission except admin.platform', () => {
    const admin = new Set(DEFAULT_ROLE_PERMISSIONS.ADMIN)
    for (const perm of Object.values(PERMISSIONS)) {
      if (perm === PERMISSIONS.ADMIN_PLATFORM) {
        expect(admin.has(perm)).toBe(false)
      } else {
        expect(admin.has(perm), `ADMIN missing ${perm}`).toBe(true)
      }
    }
  })
})
