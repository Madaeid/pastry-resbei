import { getDatabase } from '../database/db.js';

// Free ExchangeRate-API endpoint (no key required for base USD)
const EXCHANGE_RATE_API_URL = 'https://open.er-api.com/v6/latest/USD';

/**
 * Fetches latest exchange rates from API and updates the local database cache.
 */
export async function updateExchangeRates() {
    try {
        console.log('🔄 Fetching latest exchange rates...');
        const response = await fetch(EXCHANGE_RATE_API_URL);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.result !== 'success' || !data.rates) {
            throw new Error('Invalid data format received from API');
        }

        const db = getDatabase();
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Loop through all rates and upsert them
            for (const [currencyCode, rate] of Object.entries(data.rates)) {
                await client.query(`
                    INSERT INTO exchange_rates (currency_code, rate_to_usd, last_updated)
                    VALUES ($1, $2, NOW())
                    ON CONFLICT (currency_code) 
                    DO UPDATE SET rate_to_usd = EXCLUDED.rate_to_usd, last_updated = NOW()
                `, [currencyCode, rate]);
            }
            
            await client.query('COMMIT');
            console.log('✅ Exchange rates updated successfully.');
        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('❌ Failed to update exchange rates:', error.message);
    }
}

/**
 * Gets the latest cached rate for a given currency code.
 * Defaults to 1.0 for USD.
 */
export async function getRate(currencyCode) {
    if (!currencyCode || currencyCode === 'USD') return 1.0;
    
    const db = getDatabase();
    const result = await db.query('SELECT rate_to_usd FROM exchange_rates WHERE currency_code = $1', [currencyCode]);
    
    if (result.rows.length === 0) {
        console.warn(`Currency code ${currencyCode} not found in cache. Defaulting to 1.0`);
        return 1.0; // Fallback to 1:1 if not found
    }
    
    return parseFloat(result.rows[0].rate_to_usd);
}

/**
 * Converts an amount from one currency to another using cached rates.
 * Since rates are stored relative to USD (1 USD = X Target):
 * - To convert EUR to USD: amount / EUR_RATE
 * - To convert USD to EUR: amount * EUR_RATE
 * - To convert EUR to GBP: (amount / EUR_RATE) * GBP_RATE
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return parseFloat(amount);
    
    const fromRate = await getRate(fromCurrency);
    const toRate = await getRate(toCurrency);
    
    // Convert to USD first, then to target currency
    const amountInUSD = amount / fromRate;
    const amountInTarget = amountInUSD * toRate;
    
    return parseFloat(amountInTarget.toFixed(2));
}

/**
 * Initialize auto-updating cron-like interval (every 12 hours)
 */
export function initCurrencyScheduler() {
    // Initial fetch
    updateExchangeRates();
    
    // Update every 12 hours
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    setInterval(() => {
        updateExchangeRates();
    }, TWELVE_HOURS);
}

export default {
    updateExchangeRates,
    getRate,
    convertCurrency,
    initCurrencyScheduler
};
