import {env} from 'cloudflare:workers';
export function roomDb(){if(!env.DB) throw Error('Multiplayer is temporarily unavailable.');return env.DB;}
