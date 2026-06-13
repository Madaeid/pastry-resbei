import { resolve } from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true
            },
            manifest: {
                name: 'Chef Book',
                short_name: 'Chef Book',
                description: 'A beautiful collection of pastry recipes',
                theme_color: '#ffffff',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                adminAnalytics: resolve(__dirname, 'pages/admin-analytics.html'),
                admin: resolve(__dirname, 'pages/admin.html'),
                auth: resolve(__dirname, 'pages/auth.html'),
                chefProfile: resolve(__dirname, 'pages/chef-profile.html'),
                costCalculator: resolve(__dirname, 'pages/cost-calculator.html'),
                cvEdit: resolve(__dirname, 'pages/cv-edit.html'),
                cvView: resolve(__dirname, 'pages/cv-view.html'),
                dailyMenu: resolve(__dirname, 'pages/daily-menu.html'),
                daysSelection: resolve(__dirname, 'pages/days-selection.html'),
                paymentSuccess: resolve(__dirname, 'pages/payment-success.html'),
                payment: resolve(__dirname, 'pages/payment.html'),
                profilePhoto: resolve(__dirname, 'pages/profile-photo.html'),
                userAnalytics: resolve(__dirname, 'pages/user-analytics.html'),
                wallet: resolve(__dirname, 'pages/wallet.html'),
            }
        }
    },
    server: {
        open: true,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    }
})
