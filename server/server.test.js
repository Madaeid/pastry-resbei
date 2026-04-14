import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './server.js'; // Assuming this is being run from server/ directory or path adjusted

describe('Server API', () => {
    describe('GET /api/health', () => {
        it('should return 200 and ok status', async () => {
            const response = await request(app).get('/api/health');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ok');
            expect(response.body.message).toBe('Chef Book API is running');
        });
    });

    describe('GET /api/nonexistent', () => {
        it('should return 404 for unknown endpoints', async () => {
            const response = await request(app).get('/api/nonexistent');
            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Endpoint not found');
        });
    });
});
