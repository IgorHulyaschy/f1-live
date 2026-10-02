import type { Driver } from '@f1-live/shared';

/**
 * 2025 grid as published by the live timing DriverList topic (Las Vegas GP, server/data-examples).
 * Image fields are the feed's own references to formula1.com media; no image is stored here.
 */
export const MOCK_DRIVERS: readonly Driver[] = [
	{
		number: '1',
		code: 'VER',
		firstName: 'Max',
		lastName: 'Verstappen',
		team: 'Red Bull Racing',
		teamColour: '4781D7',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/redbullracing/maxver01/2025redbullracingmaxver01right'
	},
	{
		number: '4',
		code: 'NOR',
		firstName: 'Lando',
		lastName: 'Norris',
		team: 'McLaren',
		teamColour: 'F47600',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/mclaren/lannor01/2025mclarenlannor01right'
	},
	{
		number: '63',
		code: 'RUS',
		firstName: 'George',
		lastName: 'Russell',
		team: 'Mercedes',
		teamColour: '00D7B6',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/mercedes/georus01/2025mercedesgeorus01right'
	},
	{
		number: '81',
		code: 'PIA',
		firstName: 'Oscar',
		lastName: 'Piastri',
		team: 'McLaren',
		teamColour: 'F47600',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/mclaren/oscpia01/2025mclarenoscpia01right'
	},
	{
		number: '12',
		code: 'ANT',
		firstName: 'Kimi',
		lastName: 'Antonelli',
		team: 'Mercedes',
		teamColour: '00D7B6',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ANDANT01_Andrea%20Kimi_Antonelli/andant01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/mercedes/andant01/2025mercedesandant01right'
	},
	{
		number: '16',
		code: 'LEC',
		firstName: 'Charles',
		lastName: 'Leclerc',
		team: 'Ferrari',
		teamColour: 'ED1131',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/ferrari/chalec01/2025ferrarichalec01right'
	},
	{
		number: '55',
		code: 'SAI',
		firstName: 'Carlos',
		lastName: 'Sainz',
		team: 'Williams',
		teamColour: '1868DB',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/williams/carsai01/2025williamscarsai01right'
	},
	{
		number: '6',
		code: 'HAD',
		firstName: 'Isack',
		lastName: 'Hadjar',
		team: 'Racing Bulls',
		teamColour: '6C98FF',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/I/ISAHAD01_Isack_Hadjar/isahad01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/racingbulls/isahad01/2025racingbullsisahad01right'
	},
	{
		number: '27',
		code: 'HUL',
		firstName: 'Nico',
		lastName: 'Hulkenberg',
		team: 'Kick Sauber',
		teamColour: '01C00E',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/N/NICHUL01_Nico_Hulkenberg/nichul01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/kicksauber/nichul01/2025kicksaubernichul01right'
	},
	{
		number: '44',
		code: 'HAM',
		firstName: 'Lewis',
		lastName: 'Hamilton',
		team: 'Ferrari',
		teamColour: 'ED1131',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/ferrari/lewham01/2025ferrarilewham01right'
	},
	{
		number: '31',
		code: 'OCO',
		firstName: 'Esteban',
		lastName: 'Ocon',
		team: 'Haas F1 Team',
		teamColour: '9C9FA2',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/E/ESTOCO01_Esteban_Ocon/estoco01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/haasf1team/estoco01/2025haasf1teamestoco01right'
	},
	{
		number: '87',
		code: 'BEA',
		firstName: 'Oliver',
		lastName: 'Bearman',
		team: 'Haas F1 Team',
		teamColour: '9C9FA2',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/O/OLIBEA01_Oliver_Bearman/olibea01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/haasf1team/olibea01/2025haasf1teamolibea01right'
	},
	{
		number: '14',
		code: 'ALO',
		firstName: 'Fernando',
		lastName: 'Alonso',
		team: 'Aston Martin',
		teamColour: '229971',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/astonmartin/feralo01/2025astonmartinferalo01right'
	},
	{
		number: '22',
		code: 'TSU',
		firstName: 'Yuki',
		lastName: 'Tsunoda',
		team: 'Red Bull Racing',
		teamColour: '4781D7',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/Y/YUKTSU01_Yuki_Tsunoda/yuktsu01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/redbullracing/yuktsu01/2025redbullracingyuktsu01right'
	},
	{
		number: '10',
		code: 'GAS',
		firstName: 'Pierre',
		lastName: 'Gasly',
		team: 'Alpine',
		teamColour: '00A1E8',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/P/PIEGAS01_Pierre_Gasly/piegas01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/alpine/piegas01/2025alpinepiegas01right'
	},
	{
		number: '30',
		code: 'LAW',
		firstName: 'Liam',
		lastName: 'Lawson',
		team: 'Racing Bulls',
		teamColour: '6C98FF',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LIALAW01_Liam_Lawson/lialaw01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/racingbulls/lialaw01/2025racingbullslialaw01right'
	},
	{
		number: '43',
		code: 'COL',
		firstName: 'Franco',
		lastName: 'Colapinto',
		team: 'Alpine',
		teamColour: '00A1E8',
		imageId: 'common/f1/2025/alpine/fracol01/2025alpinefracol01right'
	},
	{
		number: '23',
		code: 'ALB',
		firstName: 'Alexander',
		lastName: 'Albon',
		team: 'Williams',
		teamColour: '1868DB',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/A/ALEALB01_Alexander_Albon/alealb01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/williams/alealb01/2025williamsalealb01right'
	},
	{
		number: '5',
		code: 'BOR',
		firstName: 'Gabriel',
		lastName: 'Bortoleto',
		team: 'Kick Sauber',
		teamColour: '01C00E',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/G/GABBOR01_Gabriel_Bortoleto/gabbor01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/kicksauber/gabbor01/2025kicksaubergabbor01right'
	},
	{
		number: '18',
		code: 'STR',
		firstName: 'Lance',
		lastName: 'Stroll',
		team: 'Aston Martin',
		teamColour: '229971',
		headshotUrl:
			'https://media.formula1.com/d_driver_fallback_image.png/content/dam/fom-website/drivers/L/LANSTR01_Lance_Stroll/lanstr01.png.transform/1col/image.png',
		imageId: 'common/f1/2025/astonmartin/lanstr01/2025astonmartinlanstr01right'
	}
];
