import { SessionType } from '@f1-live/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { RestInfo } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Fetch session data from API
 */
async function fetchSessionData(): Promise<RestInfo> {
	const response = await fetch(`${API_BASE_URL}/onLoad`, {
		headers: {
			'ngrok-skip-browser-warning': 'true'
		}
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	return response.json();
}

interface UseSessionDataOptions {
	enabled?: boolean;
	refetchInterval?: number | false;
}

/**
 * Hook to fetch real session data
 *
 * @param options - Configuration options
 * @param options.enabled - Whether the query should run (default: true)
 * @param options.refetchInterval - Auto-refetch interval in ms (default: false)
 *
 * @example
 * const { data, isLoading, error } = useSessionData({
 *   refetchInterval: 5000  // Refresh every 5 seconds
 * });
 */
export function useSessionData({
	enabled = true,
	refetchInterval = false
}: UseSessionDataOptions = {}): UseQueryResult<RestInfo, Error> {
	return useQuery({
		queryKey: ['session-data'],
		queryFn: fetchSessionData,
		enabled,
		refetchInterval,
		staleTime: 1000 * 5, // 5 seconds
		initialData: {
			session: {
				id: 'session_01KBA3KT0QMXZKNWT35X9MW7JK',
				name: 'Qatar Grand Prix',
				country: 'QAT',
				type: SessionType.QUALIFYING,
				date: new Date('2025-11-30')
			},
			driversLapsData: [
				{
					id: 'driver_01KB5RF87HEZDGZ4HE1MPVJ1K5',
					name: 'Yuki Tsunoda',
					number: '22',
					team: 'Red Bull Racing',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png',
					shortName: 'TSU',
					laps: [
						{
							id: 'lap_01KB80A8PJFYB680SVS7YC31W2',
							driverNumber: '22',
							lapNumber: 15,
							sector1Time: 33120,
							sector2Time: 29910,
							sector3Time: null,
							time: 92780,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807NMTXJ368Y0M8QFGR4VP',
							driverNumber: '22',
							lapNumber: 14,
							sector1Time: 33360,
							sector2Time: 29290,
							sector3Time: 29710,
							time: 92360,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8053044RW7W4HJKBFB9SY3',
							driverNumber: '22',
							lapNumber: 13,
							sector1Time: 33670,
							sector2Time: 29750,
							sector3Time: 28740,
							time: 92160,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802G7TB58R8B6NA25T4JZ0',
							driverNumber: '22',
							lapNumber: 12,
							sector1Time: 33990,
							sector2Time: 29650,
							sector3Time: 28860,
							time: 92500,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZZX8HGNYP00Z5XEFW3VF3',
							driverNumber: '22',
							lapNumber: 11,
							sector1Time: 35350,
							sector2Time: 29810,
							sector3Time: 30080,
							time: 86240,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZX9PPHAASPV91EESVEH52',
							driverNumber: '22',
							lapNumber: 10,
							sector1Time: 34780,
							sector2Time: 30320,
							sector3Time: 31270,
							time: 87370,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTPNYV2G4ENSVTY50G5GC',
							driverNumber: '22',
							lapNumber: 9,
							sector1Time: 36590,
							sector2Time: 30740,
							sector3Time: 30170,
							time: 88500,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZR35MPYWK2QYPY922YP0X',
							driverNumber: '22',
							lapNumber: 8,
							sector1Time: 36200,
							sector2Time: 32560,
							sector3Time: 31730,
							time: 91490,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNF6DWETY649F4CZ84S65',
							driverNumber: '22',
							lapNumber: 7,
							sector1Time: 37970,
							sector2Time: 33030,
							sector3Time: null,
							time: 94580,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJVFBEZ63YQE5AJFVXS5J',
							driverNumber: '22',
							lapNumber: 6,
							sector1Time: 36430,
							sector2Time: 32180,
							sector3Time: null,
							time: 92010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZG7JXXQ6F5ZZ99HZ408X3',
							driverNumber: '22',
							lapNumber: 5,
							sector1Time: 36560,
							sector2Time: null,
							sector3Time: 32270,
							time: 91900,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDKZGEW17AD189DHMJQQR',
							driverNumber: '22',
							lapNumber: 4,
							sector1Time: 36410,
							sector2Time: 33560,
							sector3Time: 32850,
							time: 93820,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB0D1JDA59JGKPBSXHDH3',
							driverNumber: '22',
							lapNumber: 3,
							sector1Time: 35010,
							sector2Time: 32440,
							sector3Time: null,
							time: 89130,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8DGHRCTBCDECK0Y93J46',
							driverNumber: '22',
							lapNumber: 2,
							sector1Time: 35230,
							sector2Time: 30920,
							sector3Time: 30460,
							time: 87610,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5SJTZKWDYD4C0TGJ9JK5',
							driverNumber: '22',
							lapNumber: 1,
							sector1Time: 33230,
							sector2Time: null,
							sector3Time: 31350,
							time: 86610,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87STWPXVG14G0Q8JJGM',
					name: 'Carlos Sainz',
					number: '55',
					team: 'Williams',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/1col/image.png',
					shortName: 'SAI',
					laps: [
						{
							id: 'lap_01KB80AMHEJFHK4Z70M6MC8DYE',
							driverNumber: '55',
							lapNumber: 15,
							sector1Time: 40670,
							sector2Time: 34670,
							sector3Time: 31390,
							time: 88730,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8080H6B0E3A46AM5Y01ADE',
							driverNumber: '55',
							lapNumber: 14,
							sector1Time: 39870,
							sector2Time: 32670,
							sector3Time: 31290,
							time: 94830,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805D6WWN6EYEB9SC7SBJA8',
							driverNumber: '55',
							lapNumber: 13,
							sector1Time: 39810,
							sector2Time: 33390,
							sector3Time: null,
							time: 86240,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802RRT2JC1JPJ280GJCFC7',
							driverNumber: '55',
							lapNumber: 12,
							sector1Time: 39190,
							sector2Time: null,
							sector3Time: 30590,
							time: 93830,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8004GV3WE004PZ5TN84MFW',
							driverNumber: '55',
							lapNumber: 11,
							sector1Time: 39340,
							sector2Time: 32680,
							sector3Time: null,
							time: 86520,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXGH7R15T6MS6ZWFBBS9Y',
							driverNumber: '55',
							lapNumber: 10,
							sector1Time: 39180,
							sector2Time: 33230,
							sector3Time: null,
							time: 87050,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTWJAE3CJPBD4617WN5S3',
							driverNumber: '55',
							lapNumber: 9,
							sector1Time: 40430,
							sector2Time: 32820,
							sector3Time: 31770,
							time: 87020,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZR814GX2J77ANQ4K88CGE',
							driverNumber: '55',
							lapNumber: 8,
							sector1Time: 38370,
							sector2Time: 36840,
							sector3Time: 31990,
							time: 89200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNKYZDRYP43BC86734MWJ',
							driverNumber: '55',
							lapNumber: 7,
							sector1Time: 39720,
							sector2Time: 33320,
							sector3Time: 32340,
							time: 87380,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK06G5PP6DWBVRDVCBKXE',
							driverNumber: '55',
							lapNumber: 6,
							sector1Time: 38510,
							sector2Time: 32250,
							sector3Time: 32460,
							time: 94220,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGCPYT28AW48YDSMFT6P2',
							driverNumber: '55',
							lapNumber: 5,
							sector1Time: 38580,
							sector2Time: 32850,
							sector3Time: 32670,
							time: 86100,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDR2XRJ03D09Y61JV5Z7F',
							driverNumber: '55',
							lapNumber: 4,
							sector1Time: 36040,
							sector2Time: 33320,
							sector3Time: 32680,
							time: 93040,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB4TD3YBE374014ABAR4Y',
							driverNumber: '55',
							lapNumber: 3,
							sector1Time: 36860,
							sector2Time: 31940,
							sector3Time: 31240,
							time: 91040,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8GTXX7KV4SQ2P8WAP60G',
							driverNumber: '55',
							lapNumber: 2,
							sector1Time: 36000,
							sector2Time: 31850,
							sector3Time: 32780,
							time: 91630,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5XDJH7BGNWMW67E7Y6K1',
							driverNumber: '55',
							lapNumber: 1,
							sector1Time: 35840,
							sector2Time: 30760,
							sector3Time: 32030,
							time: 89630,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87VDKS9WT0RGH7N319J',
					name: 'Oliver Bearman',
					number: '87',
					team: 'Haas F1 Team',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png',
					shortName: 'BEA',
					laps: [
						{
							id: 'lap_01KB80AVWV0FWPEXG50386B6AX',
							driverNumber: '87',
							lapNumber: 15,
							sector1Time: 40870,
							sector2Time: 32410,
							sector3Time: 32210,
							time: 87490,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8087KB4DW46Y1AM4CDX2YT',
							driverNumber: '87',
							lapNumber: 14,
							sector1Time: 38640,
							sector2Time: 34090,
							sector3Time: 31390,
							time: 86120,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805KQ970JH4Y5PJRD94R2W',
							driverNumber: '87',
							lapNumber: 13,
							sector1Time: 39430,
							sector2Time: null,
							sector3Time: 31840,
							time: 90190,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802Z027FBJ4PQYEF0K5GR2',
							driverNumber: '87',
							lapNumber: 12,
							sector1Time: 37620,
							sector2Time: 32900,
							sector3Time: null,
							time: 86580,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800B707MEAKJNJE5TG7JYA',
							driverNumber: '87',
							lapNumber: 11,
							sector1Time: 38140,
							sector2Time: 33740,
							sector3Time: 33510,
							time: 87390,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXPNQ7FKFFTCM7A8BPNTR',
							driverNumber: '87',
							lapNumber: 10,
							sector1Time: 39550,
							sector2Time: 34630,
							sector3Time: 25520,
							time: 90700,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV2JWBH9490PV7DM7PS5Z',
							driverNumber: '87',
							lapNumber: 9,
							sector1Time: 40140,
							sector2Time: 33100,
							sector3Time: 33490,
							time: 88730,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRE72H2KV2WQ7889AEVJQ',
							driverNumber: '87',
							lapNumber: 8,
							sector1Time: 39080,
							sector2Time: 34390,
							sector3Time: 33750,
							time: 89220,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNSQWHS5R65T10M62MPJC',
							driverNumber: '87',
							lapNumber: 7,
							sector1Time: 40830,
							sector2Time: 34230,
							sector3Time: null,
							time: 90300,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK5AFXZWNXB23G5EFXT09',
							driverNumber: '87',
							lapNumber: 6,
							sector1Time: 39950,
							sector2Time: 34200,
							sector3Time: 25180,
							time: 90330,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGH1T75HPHBSY7WDQFSAJ',
							driverNumber: '87',
							lapNumber: 5,
							sector1Time: 33260,
							sector2Time: 34470,
							sector3Time: null,
							time: 91980,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDWKQ3CNEQDC535W87G1H',
							driverNumber: '87',
							lapNumber: 4,
							sector1Time: 38370,
							sector2Time: 33560,
							sector3Time: 32450,
							time: 86380,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB898SNQ609WQHWXD32HF',
							driverNumber: '87',
							lapNumber: 3,
							sector1Time: 38700,
							sector2Time: 35550,
							sector3Time: 33050,
							time: 89300,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8M59V1JY30PPS1S9T3YJ',
							driverNumber: '87',
							lapNumber: 2,
							sector1Time: 36770,
							sector2Time: 33530,
							sector3Time: 32710,
							time: 94010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z60KQHE5SX0KDDY8NWZQ0',
							driverNumber: '87',
							lapNumber: 1,
							sector1Time: 34510,
							sector2Time: 32540,
							sector3Time: 32880,
							time: 90930,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87P8PCA6NTY5GQXKVGN',
					name: 'Esteban Ocon',
					number: '31',
					team: 'Haas F1 Team',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/1col/image.png',
					shortName: 'OCO',
					laps: [
						{
							id: 'lap_01KB80AZVX4S8KREA7557F4K4X',
							driverNumber: '31',
							lapNumber: 15,
							sector1Time: 39780,
							sector2Time: 32740,
							sector3Time: null,
							time: 88180,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB808BKTDFR3VDZAP8F44QE4',
							driverNumber: '31',
							lapNumber: 14,
							sector1Time: 38370,
							sector2Time: 33600,
							sector3Time: 32470,
							time: 86440,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805QV2DKGS72X7JTBD0PXG',
							driverNumber: '31',
							lapNumber: 13,
							sector1Time: 39820,
							sector2Time: 32470,
							sector3Time: 31770,
							time: 86060,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8033M73V4GSHT9Z1H50SN5',
							driverNumber: '31',
							lapNumber: 12,
							sector1Time: 40030,
							sector2Time: 33720,
							sector3Time: 31880,
							time: 87630,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800FMGAV0F83VQG113G6ZP',
							driverNumber: '31',
							lapNumber: 11,
							sector1Time: 39860,
							sector2Time: 34380,
							sector3Time: 32950,
							time: 89190,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXV3FF3J5DRRSY7NXXH8W',
							driverNumber: '31',
							lapNumber: 10,
							sector1Time: 38850,
							sector2Time: 33890,
							sector3Time: null,
							time: 87440,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV6TJS3Z9JV46CYSM28G6',
							driverNumber: '31',
							lapNumber: 9,
							sector1Time: 40110,
							sector2Time: 34610,
							sector3Time: 25790,
							time: 91510,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRJ70QYQBF22GMMQ0BS48',
							driverNumber: '31',
							lapNumber: 8,
							sector1Time: 37970,
							sector2Time: 36310,
							sector3Time: 33430,
							time: 89710,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNW9DK2PPHP0TGBC180ER',
							driverNumber: '31',
							lapNumber: 7,
							sector1Time: 39970,
							sector2Time: 35490,
							sector3Time: 25750,
							time: 92210,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK7KKJPVZFASFNP1BKKM6',
							driverNumber: '31',
							lapNumber: 6,
							sector1Time: 38900,
							sector2Time: 35090,
							sector3Time: 25500,
							time: 90490,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGK3SQE1TSJG7JTFVWDJF',
							driverNumber: '31',
							lapNumber: 5,
							sector1Time: 39530,
							sector2Time: 35270,
							sector3Time: 25630,
							time: 91430,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDYT8XW7X8AYS7QY8X8R6',
							driverNumber: '31',
							lapNumber: 4,
							sector1Time: 39070,
							sector2Time: 35010,
							sector3Time: 32160,
							time: 88240,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZBAD6NMC6SAFRN3G78G1J',
							driverNumber: '31',
							lapNumber: 3,
							sector1Time: 37400,
							sector2Time: 34540,
							sector3Time: 33950,
							time: 87890,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8R13AFXYYGYEGAHN05Z2',
							driverNumber: '31',
							lapNumber: 2,
							sector1Time: 36060,
							sector2Time: 32160,
							sector3Time: null,
							time: 93020,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z638ZF8PW82WHVPFNQ7C3',
							driverNumber: '31',
							lapNumber: 1,
							sector1Time: 35150,
							sector2Time: 31680,
							sector3Time: 32720,
							time: 90550,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF86YFVSS8YTXRT5B0Y84',
					name: 'Max Verstappen',
					number: '1',
					team: 'Red Bull Racing',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png',
					shortName: 'VER',
					laps: [
						{
							id: 'lap_01KB80A3PCQ1PMYENR1SE48QM7',
							driverNumber: '1',
							lapNumber: 15,
							sector1Time: 35560,
							sector2Time: 30030,
							sector3Time: 27950,
							time: 93540,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807GQWY9AG4KKHB2V2G9PY',
							driverNumber: '1',
							lapNumber: 14,
							sector1Time: 33670,
							sector2Time: 37740,
							sector3Time: 27700,
							time: 90110,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB804YASR7VS2Z39T2VE813F',
							driverNumber: '1',
							lapNumber: 13,
							sector1Time: 33430,
							sector2Time: 37910,
							sector3Time: null,
							time: 89410,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802BRT3MBEXH5ECHPWAXBS',
							driverNumber: '1',
							lapNumber: 12,
							sector1Time: 34290,
							sector2Time: 37550,
							sector3Time: null,
							time: 89810,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZZRYFMQZ79G7N3KTP3AB3',
							driverNumber: '1',
							lapNumber: 11,
							sector1Time: 35520,
							sector2Time: 37480,
							sector3Time: 27490,
							time: 91490,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZX5ZJD2GVV012672VHVAS',
							driverNumber: '1',
							lapNumber: 10,
							sector1Time: 36030,
							sector2Time: 29340,
							sector3Time: 28520,
							time: 93890,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTK6Y1G8V40C8D18ZCX2Q',
							driverNumber: '1',
							lapNumber: 9,
							sector1Time: 35590,
							sector2Time: 29760,
							sector3Time: 28430,
							time: 93780,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZR01ZG6Y3VXBRCC26B4KR',
							driverNumber: '1',
							lapNumber: 8,
							sector1Time: 35770,
							sector2Time: 30590,
							sector3Time: 27860,
							time: 85220,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNDDKJRSC4G3WDGB437D9',
							driverNumber: '1',
							lapNumber: 7,
							sector1Time: 36890,
							sector2Time: 31160,
							sector3Time: 28410,
							time: 87460,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJSDPPBGHH9HJ2ZWEH36R',
							driverNumber: '1',
							lapNumber: 6,
							sector1Time: 38410,
							sector2Time: 31620,
							sector3Time: 29160,
							time: 90190,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZG5XZ34MWTXG23279RDS2',
							driverNumber: '1',
							lapNumber: 5,
							sector1Time: 36660,
							sector2Time: 32490,
							sector3Time: 29160,
							time: 89310,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDJJYQ75XBCNK8A9QRPTV',
							driverNumber: '1',
							lapNumber: 4,
							sector1Time: 37910,
							sector2Time: 32310,
							sector3Time: 29430,
							time: 90650,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZAYFKSXM7MFPDFN1V1YV3',
							driverNumber: '1',
							lapNumber: 3,
							sector1Time: 34710,
							sector2Time: null,
							sector3Time: 30880,
							time: 90690,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8BBRESRR8JK5SQJ95W1P',
							driverNumber: '1',
							lapNumber: 2,
							sector1Time: 34350,
							sector2Time: 32580,
							sector3Time: 29310,
							time: 87240,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5R3HX49656WNCAZGV6KP',
							driverNumber: '1',
							lapNumber: 1,
							sector1Time: 33320,
							sector2Time: null,
							sector3Time: 29000,
							time: 85780,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF876B4KEXCY2Z61Z3BBK',
					name: 'Isack Hadjar',
					number: '6',
					team: 'Racing Bulls',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png',
					shortName: 'HAD',
					laps: [
						{
							id: 'lap_01KB80ANXTKH8AAYDW50K2YTSD',
							driverNumber: '6',
							lapNumber: 14,
							sector1Time: 40040,
							sector2Time: 32410,
							sector3Time: 32430,
							time: 86880,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8082415BZ4WAFP10MKJ09C',
							driverNumber: '6',
							lapNumber: 13,
							sector1Time: 39350,
							sector2Time: 31930,
							sector3Time: null,
							time: 92930,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802SPX6DK1MP8NPHCKHVED',
							driverNumber: '6',
							lapNumber: 12,
							sector1Time: 38900,
							sector2Time: 31250,
							sector3Time: 31430,
							time: 92580,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8006C8XG5M8TZ7CDFAG29A',
							driverNumber: '6',
							lapNumber: 11,
							sector1Time: 39010,
							sector2Time: 31020,
							sector3Time: 31110,
							time: 92140,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXJ9ZR1DE3560CJ9XBRTA',
							driverNumber: '6',
							lapNumber: 10,
							sector1Time: 40710,
							sector2Time: 30440,
							sector3Time: 32260,
							time: 94410,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTYAT28TTPJ4M27PK26K0',
							driverNumber: '6',
							lapNumber: 9,
							sector1Time: 40800,
							sector2Time: 32040,
							sector3Time: 33870,
							time: 88710,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZR9Y7P9QNSY3PTP5J2Z8B',
							driverNumber: '6',
							lapNumber: 8,
							sector1Time: 38770,
							sector2Time: 32350,
							sector3Time: 33380,
							time: 86500,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNNZA0H8W406B9MH4ZB0G',
							driverNumber: '6',
							lapNumber: 7,
							sector1Time: 39800,
							sector2Time: 33150,
							sector3Time: null,
							time: 86690,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK1Z441D3STVY00S1T5GB',
							driverNumber: '6',
							lapNumber: 6,
							sector1Time: 39740,
							sector2Time: 33730,
							sector3Time: 32730,
							time: 88200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGDNAQMB3NVDXCFXTVTSP',
							driverNumber: '6',
							lapNumber: 5,
							sector1Time: 40270,
							sector2Time: 33000,
							sector3Time: 31890,
							time: 87160,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDSGPWJTGXEDE2C76QW49',
							driverNumber: '6',
							lapNumber: 4,
							sector1Time: 39170,
							sector2Time: 32590,
							sector3Time: 33110,
							time: 86870,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB5K0KSCXHGW3MV5XDEWV',
							driverNumber: '6',
							lapNumber: 3,
							sector1Time: 37680,
							sector2Time: 33230,
							sector3Time: 32510,
							time: 94420,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8HHQYWZV2P2PFJXNSP11',
							driverNumber: '6',
							lapNumber: 2,
							sector1Time: 37180,
							sector2Time: 31840,
							sector3Time: 33040,
							time: 93060,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5Y9ZESP402QZBN3TD1H8',
							driverNumber: '6',
							lapNumber: 1,
							sector1Time: 35430,
							sector2Time: 30100,
							sector3Time: 32510,
							time: 89040,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87TD88S9CZA42BB6E1B',
					name: 'George Russell',
					number: '63',
					team: 'Mercedes',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png',
					shortName: 'RUS',
					laps: [
						{
							id: 'lap_01KB809YG1FC3FFB3GHDVXGNKZ',
							driverNumber: '63',
							lapNumber: 15,
							sector1Time: 33280,
							sector2Time: 33730,
							sector3Time: 26220,
							time: 93230,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807BRMV300ZR6WYJNJYBKJ',
							driverNumber: '63',
							lapNumber: 14,
							sector1Time: 31930,
							sector2Time: null,
							sector3Time: 27100,
							time: 89850,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB804SGD6EF85V7PRMF68X13',
							driverNumber: '63',
							lapNumber: 13,
							sector1Time: 32290,
							sector2Time: 30880,
							sector3Time: 27520,
							time: 90690,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8026AJ00EGG7ST7F5NH3J7',
							driverNumber: '63',
							lapNumber: 12,
							sector1Time: 31360,
							sector2Time: 30690,
							sector3Time: null,
							time: 89640,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZZKXY942Y2GB9XBDWEDY5',
							driverNumber: '63',
							lapNumber: 11,
							sector1Time: 32430,
							sector2Time: 30760,
							sector3Time: 28130,
							time: 91320,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZX11BYDQC7Y5TV5HC0APA',
							driverNumber: '63',
							lapNumber: 10,
							sector1Time: 33350,
							sector2Time: null,
							sector3Time: 29460,
							time: 86320,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTDT8RNXHWC91WKMKSPQ8',
							driverNumber: '63',
							lapNumber: 9,
							sector1Time: 34100,
							sector2Time: 31740,
							sector3Time: 27770,
							time: 93610,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZQV0T370T561433RMJZ3M',
							driverNumber: '63',
							lapNumber: 8,
							sector1Time: 33590,
							sector2Time: 31340,
							sector3Time: 28960,
							time: 93890,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZN83DHZVJFM8B9XA0B7F5',
							driverNumber: '63',
							lapNumber: 7,
							sector1Time: 33770,
							sector2Time: 31410,
							sector3Time: 29270,
							time: 85450,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJMTVRZJKW2N3FS3S6ZY1',
							driverNumber: '63',
							lapNumber: 6,
							sector1Time: 32970,
							sector2Time: 30850,
							sector3Time: 28820,
							time: 92640,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZG27EEX89GTQB8CWC4J2K',
							driverNumber: '63',
							lapNumber: 5,
							sector1Time: 32500,
							sector2Time: 31290,
							sector3Time: null,
							time: 93290,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDFFF343R51W7XH1N49SA',
							driverNumber: '63',
							lapNumber: 4,
							sector1Time: 31980,
							sector2Time: 31570,
							sector3Time: 28790,
							time: 92340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZAW2HPDH4RB193PYA7N85',
							driverNumber: '63',
							lapNumber: 3,
							sector1Time: 33400,
							sector2Time: 30970,
							sector3Time: 29480,
							time: 93850,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z893WK745RKD4APT0TA1S',
							driverNumber: '63',
							lapNumber: 2,
							sector1Time: 32320,
							sector2Time: 30840,
							sector3Time: 29400,
							time: 92560,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5P9MNABV6ZC0DP545N9P',
							driverNumber: '63',
							lapNumber: 1,
							sector1Time: 34060,
							sector2Time: 30090,
							sector3Time: 29100,
							time: 93250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87RZJWD11MPH1EH9SW0',
					name: 'Lewis Hamilton',
					number: '44',
					team: 'Ferrari',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png',
					shortName: 'HAM',
					laps: [
						{
							id: 'lap_01KB80B55GJVCBJKR0CB0RV5EW',
							driverNumber: '44',
							lapNumber: 15,
							sector1Time: 39880,
							sector2Time: 38550,
							sector3Time: 27690,
							time: 97120,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB808FG70NXPK32MQ7PPMN7H',
							driverNumber: '44',
							lapNumber: 14,
							sector1Time: 39610,
							sector2Time: 37060,
							sector3Time: 26180,
							time: 93850,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805V2RBD1N8T0TF141F6GE',
							driverNumber: '44',
							lapNumber: 13,
							sector1Time: 38430,
							sector2Time: 36570,
							sector3Time: null,
							time: 90490,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8036XR3GPMYFQF3C2NCMH2',
							driverNumber: '44',
							lapNumber: 12,
							sector1Time: 39470,
							sector2Time: 36940,
							sector3Time: 32650,
							time: 91060,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800HRPCYTW3TYY7PFHKEMZ',
							driverNumber: '44',
							lapNumber: 11,
							sector1Time: 32240,
							sector2Time: 38530,
							sector3Time: 25400,
							time: 87170,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXXQCJNRZM436TRYK8B4X',
							driverNumber: '44',
							lapNumber: 10,
							sector1Time: 35370,
							sector2Time: 35640,
							sector3Time: 33470,
							time: 86480,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV8W38XV7YCD7PTWA6AK4',
							driverNumber: '44',
							lapNumber: 9,
							sector1Time: 39880,
							sector2Time: 37350,
							sector3Time: 26490,
							time: 94720,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRKJXDPBQCRMGMXZ2D86C',
							driverNumber: '44',
							lapNumber: 8,
							sector1Time: 33090,
							sector2Time: 32190,
							sector3Time: 26670,
							time: 91950,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNYRTW6X1T6JTDRBJWSA6',
							driverNumber: '44',
							lapNumber: 7,
							sector1Time: 40300,
							sector2Time: 36690,
							sector3Time: null,
							time: 93040,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZKAFQ94126FEC0JYP8WDE',
							driverNumber: '44',
							lapNumber: 6,
							sector1Time: 38990,
							sector2Time: 35430,
							sector3Time: 25390,
							time: 90810,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGNGNHJ7XTDEZ2K266SK7',
							driverNumber: '44',
							lapNumber: 5,
							sector1Time: 37710,
							sector2Time: 38130,
							sector3Time: 25450,
							time: 92290,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZE1PVZHJDRN85V6KRCCWN',
							driverNumber: '44',
							lapNumber: 4,
							sector1Time: 36400,
							sector2Time: 33940,
							sector3Time: 31480,
							time: 92820,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZBDR3XBQ5SX62RNVMQZ9G',
							driverNumber: '44',
							lapNumber: 3,
							sector1Time: 38290,
							sector2Time: 33500,
							sector3Time: 32500,
							time: 86290,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8SBF4F26CQMX0DXP93VW',
							driverNumber: '44',
							lapNumber: 2,
							sector1Time: 36690,
							sector2Time: 37360,
							sector3Time: 32120,
							time: 88170,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z65XNW7H83Z00E0YJFK9P',
							driverNumber: '44',
							lapNumber: 1,
							sector1Time: 38380,
							sector2Time: 34930,
							sector3Time: 31820,
							time: 87130,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87ACXG65QEC9X52VW3M',
					name: 'Kimi Antonelli',
					number: '12',
					team: 'Mercedes',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ANDANT01_Andrea%20Kimi_Antonelli/andant01.png.transform/1col/image.png',
					shortName: 'ANT',
					laps: [
						{
							id: 'lap_01KB80AAR749BR5FV9ZEE37B07',
							driverNumber: '12',
							lapNumber: 15,
							sector1Time: 39310,
							sector2Time: 30270,
							sector3Time: 28060,
							time: 88640,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807R5AVG7EY186N4W76TPA',
							driverNumber: '12',
							lapNumber: 14,
							sector1Time: 31980,
							sector2Time: 30660,
							sector3Time: 28620,
							time: 91260,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8055G43YGJVJ3YQMMQ0PG3',
							driverNumber: '12',
							lapNumber: 13,
							sector1Time: 32640,
							sector2Time: null,
							sector3Time: 28620,
							time: 92450,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802J9CXM1XC8NZESCZZV1M',
							driverNumber: '12',
							lapNumber: 12,
							sector1Time: 32850,
							sector2Time: 30530,
							sector3Time: null,
							time: 93670,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZZZDSXTJCNPBWGS51WNGC',
							driverNumber: '12',
							lapNumber: 11,
							sector1Time: 33180,
							sector2Time: 31430,
							sector3Time: 30140,
							time: 85750,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXCAYZ26GN6K1B2CQGQVA',
							driverNumber: '12',
							lapNumber: 10,
							sector1Time: 33550,
							sector2Time: 31350,
							sector3Time: 30060,
							time: 85960,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTS230KBC2H5QJ2G6E3YJ',
							driverNumber: '12',
							lapNumber: 9,
							sector1Time: 32210,
							sector2Time: 31720,
							sector3Time: null,
							time: 86110,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZR5GF090Q7CYSY543FF0W',
							driverNumber: '12',
							lapNumber: 8,
							sector1Time: 36850,
							sector2Time: 35100,
							sector3Time: 31410,
							time: 94360,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNJY008DA8B5WAFF0FAPY',
							driverNumber: '12',
							lapNumber: 7,
							sector1Time: 35630,
							sector2Time: 33690,
							sector3Time: 32090,
							time: 92410,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJY579HBZC4NK6GAETDB5',
							driverNumber: '12',
							lapNumber: 6,
							sector1Time: 35000,
							sector2Time: 31830,
							sector3Time: 31770,
							time: 89600,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGAJ4RRFTQY6006WF6AHQ',
							driverNumber: '12',
							lapNumber: 5,
							sector1Time: 35880,
							sector2Time: null,
							sector3Time: 31960,
							time: 91850,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDPT4R758FE3VSJMZGH7G',
							driverNumber: '12',
							lapNumber: 4,
							sector1Time: 34880,
							sector2Time: 32070,
							sector3Time: 33020,
							time: 90970,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB3APKYBSGWRQEPWKZHN5',
							driverNumber: '12',
							lapNumber: 3,
							sector1Time: 35330,
							sector2Time: 31900,
							sector3Time: 32040,
							time: 90270,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8FY5X0KVX7NQNWEQQ1SV',
							driverNumber: '12',
							lapNumber: 2,
							sector1Time: 35740,
							sector2Time: 30950,
							sector3Time: 33050,
							time: 90740,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5W15H93HPPFHZ21PJG9P',
							driverNumber: '12',
							lapNumber: 1,
							sector1Time: 34140,
							sector2Time: 32460,
							sector3Time: 33410,
							time: 91010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87KT6C0AWBWFCF09JVR',
					name: 'Nico Hulkenberg',
					number: '27',
					team: 'Kick Sauber',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/1col/image.png',
					shortName: 'HUL',
					laps: [
						{
							id: 'lap_01KB80B0EE2XQV807YFQPPJX8E',
							driverNumber: '27',
							lapNumber: 15,
							sector1Time: 40820,
							sector2Time: 34640,
							sector3Time: 33760,
							time: 91220,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB808C7PZAJMZEB848BDTXWR',
							driverNumber: '27',
							lapNumber: 14,
							sector1Time: 36450,
							sector2Time: 33890,
							sector3Time: 30670,
							time: 92010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805RE414PKKZWDHDMZ2SWN',
							driverNumber: '27',
							lapNumber: 13,
							sector1Time: 38750,
							sector2Time: 35050,
							sector3Time: 32200,
							time: 88000,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB803463306KP2NH67M5J9PF',
							driverNumber: '27',
							lapNumber: 12,
							sector1Time: 37230,
							sector2Time: 33920,
							sector3Time: 32110,
							time: 94260,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800G1KG0JZ78MKQ4ZT1TPP',
							driverNumber: '27',
							lapNumber: 11,
							sector1Time: 40720,
							sector2Time: 35120,
							sector3Time: 25090,
							time: 91930,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXVPZR34WESCRDZBT2J27',
							driverNumber: '27',
							lapNumber: 10,
							sector1Time: 39010,
							sector2Time: 33600,
							sector3Time: 32440,
							time: 87050,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV799TJ3TRV36E25SCC1A',
							driverNumber: '27',
							lapNumber: 9,
							sector1Time: 38320,
							sector2Time: 36520,
							sector3Time: 25360,
							time: 91200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRJ8GYEP5RR43KGMWPAHA',
							driverNumber: '27',
							lapNumber: 8,
							sector1Time: 33870,
							sector2Time: 30560,
							sector3Time: 25770,
							time: 90200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNWGYF0WC3BA1CQ5393JE',
							driverNumber: '27',
							lapNumber: 7,
							sector1Time: 39000,
							sector2Time: 33720,
							sector3Time: 27880,
							time: 91600,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK874TCFXPKZ2PFD3T266',
							driverNumber: '27',
							lapNumber: 6,
							sector1Time: 39670,
							sector2Time: null,
							sector3Time: 25530,
							time: 91070,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGKK5CY6DW7HTAXVKXD49',
							driverNumber: '27',
							lapNumber: 5,
							sector1Time: 38050,
							sector2Time: 35310,
							sector3Time: 25620,
							time: 89980,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDZD5GV796D3V7BWBNVBF',
							driverNumber: '27',
							lapNumber: 4,
							sector1Time: 38280,
							sector2Time: 34990,
							sector3Time: 33980,
							time: 89250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZBB2T3F65JRHPXB3QHTWE',
							driverNumber: '27',
							lapNumber: 3,
							sector1Time: 35510,
							sector2Time: 34220,
							sector3Time: 26360,
							time: 87090,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8R15VFZ8ARQ2Z0NTCQY7',
							driverNumber: '27',
							lapNumber: 2,
							sector1Time: 35730,
							sector2Time: null,
							sector3Time: 33150,
							time: 93420,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z63FNDF1WK90QP926Y3BQ',
							driverNumber: '27',
							lapNumber: 1,
							sector1Time: 35150,
							sector2Time: 32340,
							sector3Time: 33290,
							time: 91780,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87JC3KXNGV79PX0E1MR',
					name: 'Alexander Albon',
					number: '23',
					team: 'Williams',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png',
					shortName: 'ALB',
					laps: [
						{
							id: 'lap_01KB80AP7N7MTNFRA31EKZVFFW',
							driverNumber: '23',
							lapNumber: 15,
							sector1Time: 37860,
							sector2Time: 35060,
							sector3Time: 31270,
							time: 86190,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8082AN6G6HPG3C9VSZQ0RJ',
							driverNumber: '23',
							lapNumber: 14,
							sector1Time: 37580,
							sector2Time: 32360,
							sector3Time: 31260,
							time: 92200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805EVVXGGPGAM5861DWBRS',
							driverNumber: '23',
							lapNumber: 13,
							sector1Time: 37730,
							sector2Time: 33050,
							sector3Time: 31710,
							time: 93490,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802TWT9AA1E9Q7EEK8GMH9',
							driverNumber: '23',
							lapNumber: 12,
							sector1Time: 35690,
							sector2Time: 32450,
							sector3Time: 30950,
							time: 90090,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8007FKCBKS3Y253MSRHHQH',
							driverNumber: '23',
							lapNumber: 11,
							sector1Time: 32110,
							sector2Time: 33070,
							sector3Time: 31070,
							time: 87250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXKAGVMRYNFTQQXC8C9X8',
							driverNumber: '23',
							lapNumber: 10,
							sector1Time: 38370,
							sector2Time: 33670,
							sector3Time: null,
							time: 86960,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTYZX12Q8PF0JKR8EARNQ',
							driverNumber: '23',
							lapNumber: 9,
							sector1Time: 38840,
							sector2Time: 34260,
							sector3Time: 32240,
							time: 87340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRAFPHT19GNV3J3ZNM4VX',
							driverNumber: '23',
							lapNumber: 8,
							sector1Time: 37120,
							sector2Time: 35820,
							sector3Time: 33110,
							time: 88050,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNPMCWYB98J21MHB0CZ75',
							driverNumber: '23',
							lapNumber: 7,
							sector1Time: 38080,
							sector2Time: 33540,
							sector3Time: 32610,
							time: 86230,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK2QD4DB8Y7NBXTR286KE',
							driverNumber: '23',
							lapNumber: 6,
							sector1Time: 38050,
							sector2Time: 33210,
							sector3Time: 33190,
							time: 86450,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGEGRHNTS7G1S8Q9X8Y50',
							driverNumber: '23',
							lapNumber: 5,
							sector1Time: 37770,
							sector2Time: 33160,
							sector3Time: null,
							time: 86550,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDTWHX65NRZABF6RC27EB',
							driverNumber: '23',
							lapNumber: 4,
							sector1Time: 38590,
							sector2Time: 33250,
							sector3Time: 31980,
							time: 94820,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB721R7X6NMVJEC4CRC3F',
							driverNumber: '23',
							lapNumber: 3,
							sector1Time: 38120,
							sector2Time: 32740,
							sector3Time: 32820,
							time: 94680,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8JS5HDD59GYGAM1Q8C15',
							driverNumber: '23',
							lapNumber: 2,
							sector1Time: 36890,
							sector2Time: 30900,
							sector3Time: null,
							time: 92140,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5Z1710Y01RH2CJN7A6CN',
							driverNumber: '23',
							lapNumber: 1,
							sector1Time: 35950,
							sector2Time: 32730,
							sector3Time: 31700,
							time: 91380,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87FK3YK3M98NPJ1N8ET',
					name: 'Lance Stroll',
					number: '18',
					team: 'Aston Martin',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/1col/image.png',
					shortName: 'STR',
					laps: [
						{
							id: 'lap_01KB80C7JBVVV9EAF9BFQA82FJ',
							driverNumber: '18',
							lapNumber: 15,
							sector1Time: 31770,
							sector2Time: 33050,
							sector3Time: 26270,
							time: 91090,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB809KMPDVCCXA1MEBHE5BRD',
							driverNumber: '18',
							lapNumber: 14,
							sector1Time: 35210,
							sector2Time: null,
							sector3Time: 29600,
							time: 94110,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB806Z6HPZSB70ERJ05JZTG7',
							driverNumber: '18',
							lapNumber: 13,
							sector1Time: 31740,
							sector2Time: 31510,
							sector3Time: 27880,
							time: 91130,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8043458E335GA72PTBPX3Q',
							driverNumber: '18',
							lapNumber: 12,
							sector1Time: 41940,
							sector2Time: 40980,
							sector3Time: 34400,
							time: 99320,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB801F0X9CJ06MD3G2FVQ170',
							driverNumber: '18',
							lapNumber: 11,
							sector1Time: 31190,
							sector2Time: 29190,
							sector3Time: null,
							time: 88850,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZYTK66KCJ5KF2EKCXF950',
							driverNumber: '18',
							lapNumber: 10,
							sector1Time: 60600,
							sector2Time: 34040,
							sector3Time: 30080,
							time: 115720,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV8F3WYX13N8SXK15SEJ0',
							driverNumber: '18',
							lapNumber: 9,
							sector1Time: 39710,
							sector2Time: 36310,
							sector3Time: 38570,
							time: 96590,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRKA6D410EPR4AG7YT4CB',
							driverNumber: '18',
							lapNumber: 8,
							sector1Time: 34270,
							sector2Time: null,
							sector3Time: 25990,
							time: 92790,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNXJK7N586XVTF2DNRTJ3',
							driverNumber: '18',
							lapNumber: 7,
							sector1Time: 39840,
							sector2Time: 38480,
							sector3Time: null,
							time: 88810,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK916K4B1CGM74F1J8X52',
							driverNumber: '18',
							lapNumber: 6,
							sector1Time: 38840,
							sector2Time: 36280,
							sector3Time: 33890,
							time: 91010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGMT40AWB7WEFNCD2FS3Q',
							driverNumber: '18',
							lapNumber: 5,
							sector1Time: 38140,
							sector2Time: null,
							sector3Time: 33110,
							time: 89720,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZE0A258ABK2SVFC6R49K7',
							driverNumber: '18',
							lapNumber: 4,
							sector1Time: 38240,
							sector2Time: 36760,
							sector3Time: null,
							time: 90340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZBBTHZZQF6A7TPCHHK7QS',
							driverNumber: '18',
							lapNumber: 3,
							sector1Time: 35990,
							sector2Time: 36000,
							sector3Time: null,
							time: 88840,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8R17EDJP4WPKEDYQRA0V',
							driverNumber: '18',
							lapNumber: 2,
							sector1Time: 35470,
							sector2Time: 33590,
							sector3Time: 32470,
							time: 92530,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z646N0EHBFFGHE22HM57E',
							driverNumber: '18',
							lapNumber: 1,
							sector1Time: 35820,
							sector2Time: 32730,
							sector3Time: 33290,
							time: 92840,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87P852YY484HBM1XPGY',
					name: 'Franco Colapinto',
					number: '43',
					team: 'Alpine',
					avatarUrl: null,
					shortName: 'COL',
					laps: [
						{
							id: 'lap_01KB80CA99GEVEJG8EBZNS8P4H',
							driverNumber: '43',
							lapNumber: 15,
							sector1Time: 39450,
							sector2Time: 33370,
							sector3Time: 26830,
							time: 90650,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB809P3Q7P00KFJCZB8BJH2M',
							driverNumber: '43',
							lapNumber: 14,
							sector1Time: 63870,
							sector2Time: 32550,
							sector3Time: 34120,
							time: 121540,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805ZQRA22PR9C5SMKG2QMN',
							driverNumber: '43',
							lapNumber: 13,
							sector1Time: 35350,
							sector2Time: 38230,
							sector3Time: 38790,
							time: 103370,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB80391YBAD5MTVSM2VVSSC7',
							driverNumber: '43',
							lapNumber: 12,
							sector1Time: 40210,
							sector2Time: 34650,
							sector3Time: 25960,
							time: 91820,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800MG3D33P95P6DDSZ5VS3',
							driverNumber: '43',
							lapNumber: 11,
							sector1Time: 40890,
							sector2Time: 37020,
							sector3Time: 32140,
							time: 92050,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZY07C4MM5MZ8EC9P6CJJR',
							driverNumber: '43',
							lapNumber: 10,
							sector1Time: 33430,
							sector2Time: 35400,
							sector3Time: 32920,
							time: 92750,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZVB1AF3NF9QJE61553TJ8',
							driverNumber: '43',
							lapNumber: 9,
							sector1Time: 33400,
							sector2Time: 37560,
							sector3Time: 28330,
							time: 90290,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRP4FCHGTN7C1JKPRGXS1',
							driverNumber: '43',
							lapNumber: 8,
							sector1Time: 40850,
							sector2Time: 36670,
							sector3Time: 33960,
							time: 93480,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZP1CNWW6A4QZWF8B53ZHA',
							driverNumber: '43',
							lapNumber: 7,
							sector1Time: 40740,
							sector2Time: 35610,
							sector3Time: 33120,
							time: 91470,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZKCYMHTGW93C8EBBGAT7H',
							driverNumber: '43',
							lapNumber: 6,
							sector1Time: 39980,
							sector2Time: null,
							sector3Time: 32810,
							time: 90180,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGRVMACC12C5M309ZF0HF',
							driverNumber: '43',
							lapNumber: 5,
							sector1Time: 38570,
							sector2Time: 32710,
							sector3Time: null,
							time: 93780,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZE50GNZ9B7SQ9Y5CR1PT6',
							driverNumber: '43',
							lapNumber: 4,
							sector1Time: 39110,
							sector2Time: 34560,
							sector3Time: 32750,
							time: 88420,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZBHM5W9879BRBAN26CY02',
							driverNumber: '43',
							lapNumber: 3,
							sector1Time: 38890,
							sector2Time: null,
							sector3Time: null,
							time: 89970,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8WBQRNMNH7HEDTSJGYGQ',
							driverNumber: '43',
							lapNumber: 2,
							sector1Time: 32840,
							sector2Time: 34010,
							sector3Time: 25110,
							time: 91960,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z67A5SCGY00Q1K4AHZK79',
							driverNumber: '43',
							lapNumber: 1,
							sector1Time: 39140,
							sector2Time: 34350,
							sector3Time: 29200,
							time: 93690,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87EKARRXCDWWS3DDQQ4',
					name: 'Charles Leclerc',
					number: '16',
					team: 'Ferrari',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/1col/image.png',
					shortName: 'LEC',
					laps: [
						{
							id: 'lap_01KB80AW95EFA86S9N67CTX3JT',
							driverNumber: '16',
							lapNumber: 15,
							sector1Time: 39380,
							sector2Time: 36130,
							sector3Time: 29300,
							time: 86810,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB80889GEYKCCX5QNWCZH9CB',
							driverNumber: '16',
							lapNumber: 14,
							sector1Time: 36470,
							sector2Time: 36290,
							sector3Time: 29990,
							time: 93750,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805MEBYZ0W521Y0RZDVFRS',
							driverNumber: '16',
							lapNumber: 13,
							sector1Time: 37500,
							sector2Time: 36150,
							sector3Time: 30070,
							time: 94720,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8030RBTPFBB86H5REFBMYP',
							driverNumber: '16',
							lapNumber: 12,
							sector1Time: 37000,
							sector2Time: 35710,
							sector3Time: 30020,
							time: 93730,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800CQ94NX3JRVRK50160RY',
							driverNumber: '16',
							lapNumber: 11,
							sector1Time: 39260,
							sector2Time: 35210,
							sector3Time: 29190,
							time: 94660,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXRQE9J9Y9G3KMD0H5Q5Q',
							driverNumber: '16',
							lapNumber: 10,
							sector1Time: 39050,
							sector2Time: 35140,
							sector3Time: 29630,
							time: 94820,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV57SMSS67WCQ8Q26QWR0',
							driverNumber: '16',
							lapNumber: 9,
							sector1Time: 38950,
							sector2Time: 34860,
							sector3Time: 30470,
							time: 86280,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRGQXJC2MYSAJ8MS9V9X4',
							driverNumber: '16',
							lapNumber: 8,
							sector1Time: 37400,
							sector2Time: 34740,
							sector3Time: 30370,
							time: 93510,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNVD80MY4MNTRD022NH7E',
							driverNumber: '16',
							lapNumber: 7,
							sector1Time: 40480,
							sector2Time: null,
							sector3Time: 25310,
							time: 93790,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK68ADQCXW3ZW3FYFM8ER',
							driverNumber: '16',
							lapNumber: 6,
							sector1Time: 40430,
							sector2Time: 37610,
							sector3Time: null,
							time: 92250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGHE70K7HPGXPNZN4T9BX',
							driverNumber: '16',
							lapNumber: 5,
							sector1Time: 37870,
							sector2Time: 37390,
							sector3Time: 30910,
							time: 88170,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDX5MFJCM5WYE8SPDGKWE',
							driverNumber: '16',
							lapNumber: 4,
							sector1Time: 39640,
							sector2Time: 36520,
							sector3Time: 32090,
							time: 90250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB8Q6482XZ2P89MZT7Q9Y',
							driverNumber: '16',
							lapNumber: 3,
							sector1Time: 36120,
							sector2Time: 35850,
							sector3Time: null,
							time: 86880,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8MXZHNWTDCE2SWZGE1X2',
							driverNumber: '16',
							lapNumber: 2,
							sector1Time: 35870,
							sector2Time: null,
							sector3Time: 31870,
							time: 94110,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z618RJEKAG7E429GS5087',
							driverNumber: '16',
							lapNumber: 1,
							sector1Time: 35800,
							sector2Time: 32830,
							sector3Time: null,
							time: 92180,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF878J2DPFF53CF148K3W',
					name: 'Pierre Gasly',
					number: '10',
					team: 'Alpine',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png',
					shortName: 'GAS',
					laps: [
						{
							id: 'lap_01KB80C009AV4FN31KE9516KB0',
							driverNumber: '10',
							lapNumber: 15,
							sector1Time: 38540,
							sector2Time: 29540,
							sector3Time: null,
							time: 84880,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB809BF56VXE3EA8RBB8VRNT',
							driverNumber: '10',
							lapNumber: 14,
							sector1Time: 61590,
							sector2Time: 34270,
							sector3Time: 34450,
							time: 112310,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805VWQDW0QWTGMRM84M0QS',
							driverNumber: '10',
							lapNumber: 13,
							sector1Time: 38800,
							sector2Time: 36650,
							sector3Time: 36460,
							time: 93910,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB80379K0X2B67FCNYDQC5S8',
							driverNumber: '10',
							lapNumber: 12,
							sector1Time: 38490,
							sector2Time: 36900,
							sector3Time: 33760,
							time: 91150,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800JVQ3QAYFAJZX6C29RJ6',
							driverNumber: '10',
							lapNumber: 11,
							sector1Time: 40170,
							sector2Time: 37490,
							sector3Time: 33060,
							time: 92720,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXYK3C0AV7QRB9HAXG5WJ',
							driverNumber: '10',
							lapNumber: 10,
							sector1Time: 39100,
							sector2Time: 34730,
							sector3Time: 32600,
							time: 88430,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV9TD0G7DN7SY82VQ4E9H',
							driverNumber: '10',
							lapNumber: 9,
							sector1Time: 40440,
							sector2Time: 37850,
							sector3Time: 28230,
							time: 88520,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRM2CPB50957NRRYYV2YY',
							driverNumber: '10',
							lapNumber: 8,
							sector1Time: 40170,
							sector2Time: 31970,
							sector3Time: 28110,
							time: 91250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNZHA6J0JS2FYSFVBFAB6',
							driverNumber: '10',
							lapNumber: 7,
							sector1Time: 39750,
							sector2Time: 36550,
							sector3Time: 33690,
							time: 91990,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZKB3K3D3Y2RNSG379W4DP',
							driverNumber: '10',
							lapNumber: 6,
							sector1Time: 39180,
							sector2Time: 36560,
							sector3Time: 25240,
							time: 91980,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGPZAQXP2B4ZVPQH7H42H',
							driverNumber: '10',
							lapNumber: 5,
							sector1Time: 39420,
							sector2Time: 33470,
							sector3Time: null,
							time: 86480,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZE2VJV1TT1QPKZ9TWYBRW',
							driverNumber: '10',
							lapNumber: 4,
							sector1Time: 39410,
							sector2Time: 33400,
							sector3Time: 32060,
							time: 86870,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZBEHSN08FHMSTZP4RFMNE',
							driverNumber: '10',
							lapNumber: 3,
							sector1Time: 39900,
							sector2Time: null,
							sector3Time: 33770,
							time: 89900,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8T58YNVPRM6CCY5EKEV6',
							driverNumber: '10',
							lapNumber: 2,
							sector1Time: 36740,
							sector2Time: null,
							sector3Time: 25150,
							time: 86030,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z666ZXDSWWZSGGD5B3ZAC',
							driverNumber: '10',
							lapNumber: 1,
							sector1Time: 39470,
							sector2Time: 35160,
							sector3Time: 33570,
							time: 90200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87CZVXME9FH8Z7RJYSE',
					name: 'Fernando Alonso',
					number: '14',
					team: 'Aston Martin',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/1col/image.png',
					shortName: 'ALO',
					laps: [
						{
							id: 'lap_01KB80AJ1VJJ340JKHTQQ314F4',
							driverNumber: '14',
							lapNumber: 15,
							sector1Time: 36760,
							sector2Time: 31980,
							sector3Time: null,
							time: 92430,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807YKWGFKA77V80EEK84Y7',
							driverNumber: '14',
							lapNumber: 14,
							sector1Time: 38080,
							sector2Time: 31650,
							sector3Time: null,
							time: 92790,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805AATG6DGJWY2DDYP35EK',
							driverNumber: '14',
							lapNumber: 13,
							sector1Time: 39020,
							sector2Time: 32950,
							sector3Time: 33810,
							time: 87780,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802PQZJ2V4PG0AYRMFDTR8',
							driverNumber: '14',
							lapNumber: 12,
							sector1Time: 37480,
							sector2Time: 32790,
							sector3Time: 32350,
							time: 93620,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8002ENP2QBVRVRPQ6G0GMX',
							driverNumber: '14',
							lapNumber: 11,
							sector1Time: 39280,
							sector2Time: 33250,
							sector3Time: 31860,
							time: 86390,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXEDBTX1M7DENE60K4SE8',
							driverNumber: '14',
							lapNumber: 10,
							sector1Time: 38720,
							sector2Time: 33800,
							sector3Time: 32070,
							time: 86590,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTT95DDCNFPDP0HKT2XF9',
							driverNumber: '14',
							lapNumber: 9,
							sector1Time: 37310,
							sector2Time: 36360,
							sector3Time: 32990,
							time: 88660,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZR4VHA9B1FVBD8MBBJD0F',
							driverNumber: '14',
							lapNumber: 8,
							sector1Time: 38360,
							sector2Time: 33610,
							sector3Time: 26260,
							time: 89230,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNJXZ8X4EBHG319R88723',
							driverNumber: '14',
							lapNumber: 7,
							sector1Time: 37570,
							sector2Time: 33840,
							sector3Time: 31150,
							time: 93560,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJXGCMCP5GBHVWNBF46GE',
							driverNumber: '14',
							lapNumber: 6,
							sector1Time: 35620,
							sector2Time: 33300,
							sector3Time: 30490,
							time: 90410,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZG9X9HHRKCGB8V30NDNXW',
							driverNumber: '14',
							lapNumber: 5,
							sector1Time: 35390,
							sector2Time: 32950,
							sector3Time: 31590,
							time: 90930,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDPC2JNV7BB0NTQ9NK7VX',
							driverNumber: '14',
							lapNumber: 4,
							sector1Time: 35320,
							sector2Time: 32790,
							sector3Time: 32710,
							time: 91820,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB2P962WYT0DSC09H80J1',
							driverNumber: '14',
							lapNumber: 3,
							sector1Time: 34700,
							sector2Time: 31960,
							sector3Time: 32680,
							time: 90340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8EW2XPGY2JT4N7S5W4QR',
							driverNumber: '14',
							lapNumber: 2,
							sector1Time: 36100,
							sector2Time: 32090,
							sector3Time: null,
							time: 91280,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5VCCVA0MZYD5DK2H7N3F',
							driverNumber: '14',
							lapNumber: 1,
							sector1Time: 35530,
							sector2Time: 31200,
							sector3Time: 32280,
							time: 90010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF875DBDQREC7P2TWTGFX',
					name: 'Gabriel Bortoleto',
					number: '5',
					team: 'Kick Sauber',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png.transform/1col/image.png',
					shortName: 'BOR',
					laps: [
						{
							id: 'lap_01KB80AT2CJ6N3MWA2RRHN3GY0',
							driverNumber: '5',
							lapNumber: 15,
							sector1Time: 39350,
							sector2Time: 32240,
							sector3Time: 26200,
							time: 88790,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8085ZR212C47K4P4DQGGQR',
							driverNumber: '5',
							lapNumber: 14,
							sector1Time: 36600,
							sector2Time: 32490,
							sector3Time: null,
							time: 93130,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805J1SRBYP6KK70S1F4B7N',
							driverNumber: '5',
							lapNumber: 13,
							sector1Time: 38850,
							sector2Time: 32750,
							sector3Time: null,
							time: 86550,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB802Y0TYQAPJ10PTQNARK62',
							driverNumber: '5',
							lapNumber: 12,
							sector1Time: 37070,
							sector2Time: null,
							sector3Time: 32790,
							time: 94790,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8009TR165GM1FJSQZTD0VK',
							driverNumber: '5',
							lapNumber: 11,
							sector1Time: 37790,
							sector2Time: 33890,
							sector3Time: null,
							time: 87450,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXNF41ENDY0SV4HM46ZZ1',
							driverNumber: '5',
							lapNumber: 10,
							sector1Time: 38840,
							sector2Time: 35190,
							sector3Time: 25890,
							time: 90920,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV187KGVGYSA5XJHCDDJK',
							driverNumber: '5',
							lapNumber: 9,
							sector1Time: 39830,
							sector2Time: 34150,
							sector3Time: 25930,
							time: 90910,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRD780NV5ETRRD2NWV5XY',
							driverNumber: '5',
							lapNumber: 8,
							sector1Time: 38400,
							sector2Time: 34940,
							sector3Time: 33960,
							time: 89300,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNSKTYCYXGK81HCTD422A',
							driverNumber: '5',
							lapNumber: 7,
							sector1Time: 38510,
							sector2Time: 34850,
							sector3Time: 25890,
							time: 90250,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK40HM62W060DSCQWKYTE',
							driverNumber: '5',
							lapNumber: 6,
							sector1Time: 38970,
							sector2Time: 35180,
							sector3Time: 26970,
							time: 92120,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGF8F6WDFTJ3J0PYRSGQ4',
							driverNumber: '5',
							lapNumber: 5,
							sector1Time: 36170,
							sector2Time: 36530,
							sector3Time: 33330,
							time: 88030,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDV6G8HC67TVVBZPQWDBK',
							driverNumber: '5',
							lapNumber: 4,
							sector1Time: 35780,
							sector2Time: null,
							sector3Time: 33720,
							time: 87320,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB7AX97CXQK19NXV9Q2J7',
							driverNumber: '5',
							lapNumber: 3,
							sector1Time: 36620,
							sector2Time: 33840,
							sector3Time: 32860,
							time: 94320,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8KQBRZ2W7N4XA6DFZCZA',
							driverNumber: '5',
							lapNumber: 2,
							sector1Time: 35750,
							sector2Time: 33650,
							sector3Time: 31710,
							time: 92110,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5ZW26WFVESVDS58K64AG',
							driverNumber: '5',
							lapNumber: 1,
							sector1Time: 35540,
							sector2Time: null,
							sector3Time: 33690,
							time: 92540,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF873FRTH8F14M0TMCDGZ',
					name: 'Lando Norris',
					number: '4',
					team: 'McLaren',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png',
					shortName: 'NOR',
					laps: [
						{
							id: 'lap_01KB80A0DC9MDFRG5NQ060S87E',
							driverNumber: '4',
							lapNumber: 15,
							sector1Time: 35570,
							sector2Time: 30390,
							sector3Time: 31670,
							time: 88630,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807E25V5SZ13HD9AESJGQZ',
							driverNumber: '4',
							lapNumber: 14,
							sector1Time: 33490,
							sector2Time: 29020,
							sector3Time: null,
							time: 89070,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB804V0VXFB0J2YS0W3F9XD7',
							driverNumber: '4',
							lapNumber: 13,
							sector1Time: 33910,
							sector2Time: 32870,
							sector3Time: 26020,
							time: 92800,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB80289DA4CEKJ1D88S5YZNA',
							driverNumber: '4',
							lapNumber: 12,
							sector1Time: 34490,
							sector2Time: null,
							sector3Time: 25780,
							time: 90500,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZZNE9V49YMB52T3EP1K0W',
							driverNumber: '4',
							lapNumber: 11,
							sector1Time: 34570,
							sector2Time: 31620,
							sector3Time: 27320,
							time: 93510,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZX2WGPKVZMWCZDY62CC9R',
							driverNumber: '4',
							lapNumber: 10,
							sector1Time: 33750,
							sector2Time: 30300,
							sector3Time: null,
							time: 91060,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTGBB6F0G045NF0QCSF6P',
							driverNumber: '4',
							lapNumber: 9,
							sector1Time: 35010,
							sector2Time: 31910,
							sector3Time: 26620,
							time: 93540,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZQWQSKF7EM6VRSJ7493M2',
							driverNumber: '4',
							lapNumber: 8,
							sector1Time: 34730,
							sector2Time: 30490,
							sector3Time: 26880,
							time: 92100,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZN9WBPEMDZQC3QG0GZDX1',
							driverNumber: '4',
							lapNumber: 7,
							sector1Time: 34630,
							sector2Time: 30850,
							sector3Time: 27110,
							time: 92590,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJQ3MT96M9T25H0EPCVCV',
							driverNumber: '4',
							lapNumber: 6,
							sector1Time: 35340,
							sector2Time: 31470,
							sector3Time: null,
							time: 85210,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZG3VSZEV4MM960G126JJE',
							driverNumber: '4',
							lapNumber: 5,
							sector1Time: 34400,
							sector2Time: 31630,
							sector3Time: 27930,
							time: 93960,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDGR91EG71YVQWWR64SY9',
							driverNumber: '4',
							lapNumber: 4,
							sector1Time: 33660,
							sector2Time: 32930,
							sector3Time: 28100,
							time: 85690,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZAXM3AD854R2VE93RV9P8',
							driverNumber: '4',
							lapNumber: 3,
							sector1Time: 34600,
							sector2Time: null,
							sector3Time: 29210,
							time: 86890,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8AFABSB7HNXG46M943RE',
							driverNumber: '4',
							lapNumber: 2,
							sector1Time: 33910,
							sector2Time: 31140,
							sector3Time: 29760,
							time: 85810,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5QDX75GZT2RPD7R70VBE',
							driverNumber: '4',
							lapNumber: 1,
							sector1Time: 32770,
							sector2Time: null,
							sector3Time: 29630,
							time: 93690,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87T5J5E1VACTXTCZA2X',
					name: 'Oscar Piastri',
					number: '81',
					team: 'McLaren',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png',
					shortName: 'PIA',
					laps: [
						{
							id: 'lap_01KB809VB4DJPZ6MA9WFQS4EEZ',
							driverNumber: '81',
							lapNumber: 14,
							sector1Time: 39770,
							sector2Time: 35370,
							sector3Time: 26740,
							time: 92880,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB807993SXQMRCMCQZGN7QX4',
							driverNumber: '81',
							lapNumber: 13,
							sector1Time: 32130,
							sector2Time: 34640,
							sector3Time: 26710,
							time: 84480,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB804Q6KM73HJQT63VA5HAJ2',
							driverNumber: '81',
							lapNumber: 12,
							sector1Time: 31370,
							sector2Time: null,
							sector3Time: 27530,
							time: 84830,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8024QB1YGW6EDA8H3YBXS2',
							driverNumber: '81',
							lapNumber: 11,
							sector1Time: 32800,
							sector2Time: 35380,
							sector3Time: 30790,
							time: 89970,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZZHR9XW3DQQV5NV99JYFZ',
							driverNumber: '81',
							lapNumber: 10,
							sector1Time: 33740,
							sector2Time: 36880,
							sector3Time: 31610,
							time: 93230,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZWZ28B5PNGDT3PKYTB77Y',
							driverNumber: '81',
							lapNumber: 9,
							sector1Time: 33570,
							sector2Time: null,
							sector3Time: 32500,
							time: 93760,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZTBXHCZA0E50PKWQ071A0',
							driverNumber: '81',
							lapNumber: 8,
							sector1Time: 33640,
							sector2Time: 36220,
							sector3Time: 32150,
							time: 93010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZQSQ4ASCT2X6SMFY15FPY',
							driverNumber: '81',
							lapNumber: 7,
							sector1Time: 33860,
							sector2Time: 37610,
							sector3Time: 31540,
							time: 85010,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZN613YPDQ3XVDDAFYKFDP',
							driverNumber: '81',
							lapNumber: 6,
							sector1Time: 34740,
							sector2Time: 36430,
							sector3Time: 31820,
							time: 93990,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZJK32TBPBKT45TMGTEGWM',
							driverNumber: '81',
							lapNumber: 5,
							sector1Time: 33570,
							sector2Time: null,
							sector3Time: 30300,
							time: 91380,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZG04HTESZ6TFWC5541M85',
							driverNumber: '81',
							lapNumber: 4,
							sector1Time: 33880,
							sector2Time: 36980,
							sector3Time: 31040,
							time: 92900,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDDG03F9TC14NB285RDWG',
							driverNumber: '81',
							lapNumber: 3,
							sector1Time: 33900,
							sector2Time: 36080,
							sector3Time: 30100,
							time: 91080,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z885QH0BDFY75SP1S6MGG',
							driverNumber: '81',
							lapNumber: 2,
							sector1Time: 33470,
							sector2Time: 34830,
							sector3Time: null,
							time: 90340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z5N1QC3E4AKWBN8G1WP01',
							driverNumber: '81',
							lapNumber: 1,
							sector1Time: 34630,
							sector2Time: 36610,
							sector3Time: 32110,
							time: 85350,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				},
				{
					id: 'driver_01KB5RF87NH1XMKQ8K6EWMTTDJ',
					name: 'Liam Lawson',
					number: '30',
					team: 'Racing Bulls',
					avatarUrl:
						'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png',
					shortName: 'LAW',
					laps: [
						{
							id: 'lap_01KB80AXFF7NEFS10NCZQGHSDC',
							driverNumber: '30',
							lapNumber: 15,
							sector1Time: 39850,
							sector2Time: 34770,
							sector3Time: 27140,
							time: 92760,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8089NMKY87Z2BYCTFMM9D2',
							driverNumber: '30',
							lapNumber: 14,
							sector1Time: 38180,
							sector2Time: 33200,
							sector3Time: 30020,
							time: 92400,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB805NWDY6Y5D1F9FM8MRJWY',
							driverNumber: '30',
							lapNumber: 13,
							sector1Time: 38040,
							sector2Time: 33520,
							sector3Time: 31830,
							time: 94390,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB8032ABXZXY8HGQKQFKCBR2',
							driverNumber: '30',
							lapNumber: 12,
							sector1Time: 37740,
							sector2Time: 33370,
							sector3Time: 31210,
							time: 93320,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB800E1F3XVNY9SAXYQVTJ8B',
							driverNumber: '30',
							lapNumber: 11,
							sector1Time: 39720,
							sector2Time: 33420,
							sector3Time: 32600,
							time: 87740,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZXSV4G6GC27KVTJW8PFD3',
							driverNumber: '30',
							lapNumber: 10,
							sector1Time: 38970,
							sector2Time: 32430,
							sector3Time: 32720,
							time: 86120,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZV5Q06X7GJKBXYNMT5VVD',
							driverNumber: '30',
							lapNumber: 9,
							sector1Time: 40280,
							sector2Time: 33900,
							sector3Time: 32160,
							time: 88340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZRHD3PFFS224R1JDCPAQ5',
							driverNumber: '30',
							lapNumber: 8,
							sector1Time: 41390,
							sector2Time: 34990,
							sector3Time: 31300,
							time: 89680,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZNVXM4ENT02Y05RFNBW7T',
							driverNumber: '30',
							lapNumber: 7,
							sector1Time: 34400,
							sector2Time: 37960,
							sector3Time: null,
							time: 90360,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZK6WJ735TXMRZF0518G1T',
							driverNumber: '30',
							lapNumber: 6,
							sector1Time: 38580,
							sector2Time: 37690,
							sector3Time: 33070,
							time: 91340,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZGJ8YWFCV8NRJE0QADS6W',
							driverNumber: '30',
							lapNumber: 5,
							sector1Time: 37940,
							sector2Time: 36640,
							sector3Time: 32440,
							time: 89020,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZDXX8S7SYX14JP6ANJ6BW',
							driverNumber: '30',
							lapNumber: 4,
							sector1Time: 40040,
							sector2Time: 36000,
							sector3Time: 32850,
							time: 90890,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7ZB9R2P5BCBHK3Y9VNMSXF',
							driverNumber: '30',
							lapNumber: 3,
							sector1Time: 37350,
							sector2Time: 33620,
							sector3Time: 32190,
							time: 94160,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z8NRKGCYHEB0Q8MJYJG3N',
							driverNumber: '30',
							lapNumber: 2,
							sector1Time: 35440,
							sector2Time: 34400,
							sector3Time: 25280,
							time: 86120,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						},
						{
							id: 'lap_01KB7Z622BD2780GRPHR5BNW87',
							driverNumber: '30',
							lapNumber: 1,
							sector1Time: 34910,
							sector2Time: 33180,
							sector3Time: 32110,
							time: 91200,
							sessionId: 'session_01KBA3KT0QMXZKNWT35X9MW7JK'
						}
					]
				}
			]
		}
	});
}
