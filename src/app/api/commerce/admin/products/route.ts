import {NextRequest,NextResponse} from 'next/server';
import {adminAuthorized,sameOrigin} from '@/lib/commerce/auth';
import {pool} from '@/lib/commerce/db';
import {parseUnits} from 'viem';
export const runtime='nodejs';
export async function GET(){if(!await adminAuthorized())return NextResponse.json({error:'Unauthorized'},{status:401});const {rows}=await pool.query('SELECT * FROM commerce_products ORDER BY created_at DESC');return NextResponse.json({products:rows});}
export async function POST(req:NextRequest){
 if(!sameOrigin(req)||!await adminAuthorized())return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const b=await req.json();const name=String(b.name||'').trim(),slug=String(b.slug||'').toLowerCase().trim();
  const image=String(b.imageUrl||'').trim();
  if(image&&(image.length>2048||!/^https:\/\/[^\s]+$/i.test(image)))throw Error('Product image must be a valid HTTPS URL');
  if(!['PICKUP','DIGITAL'].includes(b.fulfillment))throw Error('Select product fulfillment');
  const price=parseUnits(String(b.priceUsd||''),6);const stock=Number(b.stock);
  if(name.length<3||name.length>120||!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(slug)||price<=0||price>2n**63n-1n||!Number.isInteger(stock)||stock<0||stock>1e6)throw Error('Invalid product details');
  const {rows}=await pool.query('INSERT INTO commerce_products(name,slug,description,category,price_usdc,stock_on_hand,image_url,fulfillment_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[name,slug,String(b.description||'').slice(0,1000),String(b.category||'Essentials').slice(0,60),price.toString(),stock,image||null,b.fulfillment]);
  return NextResponse.json({product:rows[0]},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid product'},{status:400});}
}
export async function PATCH(req:NextRequest){
 if(!sameOrigin(req)||!await adminAuthorized())return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const b=await req.json();if(!/^[0-9a-f-]{36}$/i.test(b.id))throw Error('Invalid product');
  if(typeof b.active==='boolean'){
   const {rows}=await pool.query('UPDATE commerce_products SET active=$1,updated_at=now() WHERE id=$2 RETURNING *',[b.active,b.id]);
   return NextResponse.json({product:rows[0]});
  }
  const stock=Number(b.stock);
  if(!Number.isInteger(stock)||stock<0||stock>1e6)throw Error('Invalid stock');
  const {rows}=await pool.query('UPDATE commerce_products SET stock_on_hand=$1,updated_at=now() WHERE id=$2 AND stock_reserved<=$1 RETURNING *',[stock,b.id]);
  if(!rows.length)return NextResponse.json({error:'Stock cannot be smaller than reservations'},{status:409});
  return NextResponse.json({product:rows[0]});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid request'},{status:400});}
}
