import { test, expect } from '@playwright/test'

test.describe('Client auth flows', () => {
  test('renders login form and navigates to reset password', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /Welcome to BinBird/i })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password').first()).toBeVisible()
    await Promise.all([
      page.waitForURL(/client\/reset/),
      page.getByRole('link', { name: /Forgot password/i }).click(),
    ])
    await expect(page).toHaveURL(/client\/reset/)
    await expect(page.getByRole('heading', { name: /Reset password/i })).toBeVisible()
  })
})
