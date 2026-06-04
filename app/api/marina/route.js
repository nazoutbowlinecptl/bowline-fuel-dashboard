import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/marina?name=lake-oconee
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || 'lake-oconee';
    
    const result = await sql`
      SELECT id, name, display_name, address, region, vendor, 
             max_capacity, target_margin, current_inventory
      FROM marinas
      WHERE name = ${name}
    `;
    
    if (result.length === 0) {
      return Response.json({ error: 'Marina not found' }, { status: 404 });
    }
    
    return Response.json({ marina: result[0] });
  } catch (err) {
    console.error('GET /marina error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/marina  — update settings like inventory, target margin, vendor
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { name, current_inventory, target_margin, vendor } = body;
    
    if (!name) {
      return Response.json({ error: 'Marina name required' }, { status: 400 });
    }
    
    const result = await sql`
      UPDATE marinas
      SET 
        current_inventory = COALESCE(${current_inventory ?? null}, current_inventory),
        target_margin = COALESCE(${target_margin ?? null}, target_margin),
        vendor = COALESCE(${vendor ?? null}, vendor),
        updated_at = NOW()
      WHERE name = ${name}
      RETURNING id, name, current_inventory, target_margin, vendor
    `;
    
    if (result.length === 0) {
      return Response.json({ error: 'Marina not found' }, { status: 404 });
    }
    
    return Response.json({ marina: result[0] });
  } catch (err) {
    console.error('PATCH /marina error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}