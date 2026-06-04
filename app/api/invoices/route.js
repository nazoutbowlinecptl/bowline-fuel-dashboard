import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/invoices?marina=lake-oconee
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const marina = searchParams.get('marina') || 'lake-oconee';
    
    const invoices = await sql`
      SELECT i.id, i.invoice_date, i.vendor, i.fuel_type, 
             i.gallons, i.total_cost, i.price_per_gallon, i.created_at
      FROM invoices i
      JOIN marinas m ON i.marina_id = m.id
      WHERE m.name = ${marina}
      ORDER BY i.invoice_date DESC
    `;
    
    return Response.json({ invoices });
  } catch (err) {
    console.error('GET /invoices error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/invoices
export async function POST(request) {
  try {
    const body = await request.json();
    const { marina, invoice_date, vendor, fuel_type, gallons, total_cost } = body;
    
    if (!marina || !invoice_date || !vendor || !fuel_type || !gallons || !total_cost) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const result = await sql`
      INSERT INTO invoices (marina_id, invoice_date, vendor, fuel_type, gallons, total_cost)
      SELECT id, ${invoice_date}, ${vendor}, ${fuel_type}, ${gallons}, ${total_cost}
      FROM marinas WHERE name = ${marina}
      RETURNING id, invoice_date, vendor, fuel_type, gallons, total_cost, price_per_gallon
    `;
    
    if (result.length === 0) {
      return Response.json({ error: 'Marina not found' }, { status: 404 });
    }
    
    return Response.json({ invoice: result[0] });
  } catch (err) {
    console.error('POST /invoices error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/invoices?id=123
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return Response.json({ error: 'Missing id' }, { status: 400 });
    }
    
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (err) {
    console.error('DELETE /invoices error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}