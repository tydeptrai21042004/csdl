import type { Metadata } from 'next';
import Shell from '@/components/Shell';
import './globals.css';
export const metadata: Metadata={title:'Intercity | Find buses, choose seats & manage tickets',description:'Search intercity bus departures, choose your seats, and manage booking records online.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Shell>{children}</Shell></body></html>;}
