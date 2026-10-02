# Competitors: live timing and race analysis

What fans use in October 2026 for live timing and race analysis, how Pitwall compares, and what
is missing. Research only: nothing here decides scope, prices or the plan order.

- **Checked:** 2026-10-03, from product sites, docs, changelogs, app store listings, GitHub,
  Hacker News and forums. Every claim links its source; "not found" means we looked and saw none.
- **Pitwall reference:** branch `m1` at `f3f20d4`, the modelled replay of the 2025 Las Vegas race
  ([README][pw-readme], [dashboards][pw-dash], [screenshots][pw-shots]).
- **Limits:** Reddit refuses automated access (HTTP 403 and a bot check) and the Redlib mirrors
  run anti-scraper checks, so no Reddit thread is quoted. Fan comments come from Hacker News,
  Lemmy, GitHub issues, app store reviews and the F1Technical forum instead. Ratings with fewer
  than ~100 reviews are weak evidence.

## Products checked

| Product                               | Kind                                    | Status in October 2026                                                        |
| ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------- |
| Official F1 app and F1 TV live timing | Official mobile, web and TV apps        | Active; app 13.27.0 ([App Store][f1-app])                                     |
| [MultiViewer][mv-site]                | Desktop player plus live timing windows | Active; v2.8.4, 18 Aug 2026 ([changelog][mv-log])                             |
| [f1-dash][f1dash-gh]                  | Open-source web dashboard               | Hosted site sunset; self-host only ([site][f1dash-site])                      |
| [Nitrous][nitrous]                    | Desktop app, f1-dash successor          | First public release, announced with the f1-dash sunset ([site][f1dash-site]) |
| [Undercut-F1][uf1]                    | Open-source terminal app                | Active; v4.0.103, 20 Jul 2026 ([releases][uf1-releases])                      |
| [F1 COSMOS][cosmos]                   | Free web dashboard                      | Active; v1.15.1 ([site][cosmos])                                              |
| [TracingInsights][ti]                 | Post-session analysis site              | Active; 2026 data published ([data][ti-data])                                 |
| [GP Tempo][gpt] (formerly F1 Tempo)   | FastF1-based telemetry site             | Active; 2026 seasons selectable ([app][gpt-app])                              |
| [Fastlytics][fastlytics]              | FastF1-style analysis, paid tier        | Active ([site][fastlytics])                                                   |
| [Formula Live Pulse][flp]             | Third-party mobile live timing          | Active; v3.0.7 ([App Store][flp])                                             |
| [Box Box Club][bbc]                   | Mobile widgets and race companion       | Active; v5.5.2 ([App Store][bbc])                                             |

GP Tempo is the same product as F1 Tempo: its X handle and membership page still use the old name
([site][gpt], [membership][gpt-member]).

## Data access in 2026

These facts shape several gaps below, so they come first.

- **The live feed hides some topics without an F1 TV login.** Since the 2025 Dutch GP, live car
  positions, the DRS indicator, championship tables and pit stop times need an F1 TV
  subscription. Importing a session after it ends still returns all of them
  ([Undercut-F1 README][uf1]). The 2026 archive for the Azerbaijan race serves `CarData.z`,
  `Position.z`, `TeamRadio`, `ChampionshipPrediction` and `OvertakeSeries` without a login
  ([race index][archive-baku]).
- **F1 blocks cloud hosts.** `livetiming.formula1.com` has answered 403 to VPS providers, Colab
  and GitHub Actions since at least May 2026; home connections work ([issue][cloud-403]). The
  f1-dash author named IP restrictions as a reason to stop the hosted site ([site][f1dash-site]).
- **OpenF1 is free for history, paid for live, and non-commercial.** History from 2023 is free;
  live data is for sponsors at €9.90 a month, personal use only ([OpenF1][openf1]).
- **2026 cars have no DRS.** MultiViewer removed DRS from its overlay and draws static
  straight-mode zones and overtake-mode detection points instead, because the feed exposes no
  live data for either mode ([changelog][mv-log]). A decoded sample of that race's car data
  has no DRS channel ([race index][archive-baku]).

## Feature matrix

Three tables, one product per row. Pitwall describes `m1` today, on mock data.

### Data: timing, history, telemetry and strategy

| Product            | Live timing depth                                                                                                                                                                                                                    | Replays and history                                                                                                                               | Telemetry and track map                                                                                                                | Strategy and tyres                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pitwall            | Tower with interval or leader gap, last lap, three sectors in purple and green, last five laps, tyre and age, stops, DRS, pit and penalties; race control; weather; flag banner. Mock data ([README][pw-readme], [plan 1][pw-plan1]) | Lap-by-lap replay of one race, 2025 Las Vegas, with modelled lap times ([README][pw-readme])                                                      | None                                                                                                                                   | Stints, pit stops against a typical stop, tyre wear per stint, true pace, Box now rejoin with a ghost row, battle chart ([dashboards][pw-dash], [screenshots][pw-shots]) |
| Official F1 app    | Free leaderboard with live timing; F1 TV Access adds tyres, lap times, speed and DRS ([App Store][f1-app]); live timing in every F1 TV tier ([F1 TV listing][f1tv-ios])                                                              | Replay of live timing; an avoid-spoilers mode added July 2026 ([App Store][f1-app]); F1 TV has session replays and a race archive ([F1 TV][f1tv]) | Driver tracker map and per-driver speed, gear and throttle, for Access ([App Store][f1-app], [2019 article][f1-lt-2019])               | Tyre information per driver, for Access ([App Store][f1-app]); no stint or pit view found                                                                                |
| MultiViewer        | Mini sectors, speeds, lap times, colour-coded race control, AI radio transcripts ([site][mv-site], [changelog][mv-log])                                                                                                              | Timing synced to F1 TV replays; depth is F1 TV's archive ([site][mv-site])                                                                        | Track map with marshal-sector status, pit lane, speed traps and 2026 modes; onboard speedometer ([site][mv-site], [changelog][mv-log]) | Race Trace with gap, undercuts and pit prediction; lap time series with tyres; championship predictions window ([site][mv-site], [changelog][mv-log])                    |
| f1-dash            | Leaderboard, tyres, gaps, laps, mini sectors ([repo][f1dash-gh])                                                                                                                                                                     | No archive replay; asked for since 2023 ([#37][f1dash-37])                                                                                        | Track map; live positions now need F1 TV ([repo][f1dash-gh], [Undercut-F1 README][uf1])                                                | Current tyre on the leaderboard; a weekend tyre usage view is requested ([repo][f1dash-gh], [#272][f1dash-272])                                                          |
| Nitrous            | Sectors, gaps, intervals, pit data, race control ([site][nitrous])                                                                                                                                                                   | Replay any past session; scrub and jump to events ([site][nitrous])                                                                               | Track map from position data; speed, throttle, brake, gear, DRS ([site][nitrous])                                                      | Not listed                                                                                                                                                               |
| Undercut-F1        | Tower with sectors, best and last laps, gaps; race control; driver compare; team radio with local Whisper transcripts ([README][uf1])                                                                                                | Records and imports sessions; timing tower at the end of each lap ([README][uf1])                                                                 | Driver tracker map in the terminal; live positions need F1 TV ([README][uf1])                                                          | Stint history with tyre age and pit stops ([README][uf1])                                                                                                                |
| F1 COSMOS          | Lap, sector and tyre views; race control with a blue-flag filter; pit stop panel; weather with an hourly forecast ([live page][cosmos-live])                                                                                         | Replay section ([site][cosmos])                                                                                                                   | Track map, driver telemetry and lap time pages ([site][cosmos], [live page][cosmos-live])                                              | Pit lane and stationary times ([live page][cosmos-live])                                                                                                                 |
| TracingInsights    | None seen; its live dashboard showed no data ([dashboard][ti-dash])                                                                                                                                                                  | From 30 minutes after a session; seasons back to 2018 ([site][ti], [note][ti-substack])                                                           | Lap telemetry from a lap time heatmap, sector-aligned at about 3.7 Hz; G-force plots; circuit maps ([site][ti], [data][ti-data])       | Stints, tyre strategy and degradation, pit stops, race trace, overtakes ([site][ti])                                                                                     |
| GP Tempo           | None                                                                                                                                                                                                                                 | FastF1 sessions; 2025 and 2026 seen ([site][gpt], [app][gpt-app])                                                                                 | Speed, throttle, brake, RPM, gear and DRS across laps; track domination map ([site][gpt])                                              | Lap times through a stint ([site][gpt])                                                                                                                                  |
| Fastlytics         | Not clearly live                                                                                                                                                                                                                     | Free: current season and 5 minutes of replay; Pro: archive ([site][fastlytics])                                                                   | Track dominance; telemetry overlay of up to 4 drivers ([site][fastlytics])                                                             | Tyre strategy, pit-window alerts ([site][fastlytics])                                                                                                                    |
| Formula Live Pulse | Gaps, laps, sectors, race pace, pit stops, radio, race control; F2, F3, F1 Academy and WEC too ([App Store][flp])                                                                                                                    | Not stated                                                                                                                                        | Track map and driver tracker ([App Store][flp])                                                                                        | Tyre and pit strategy, head-to-head ([App Store][flp])                                                                                                                   |
| Box Box Club       | Live race updates in widgets and Live Activities; depth not stated ([App Store][bbc])                                                                                                                                                | Results, stats and fan race ratings ([App Store][bbc])                                                                                            | None listed                                                                                                                            | None listed                                                                                                                                                              |

### Layout and reach: dashboards, windows, mobile and sharing

| Product            | Custom dashboards and layout                                                                                                        | Multi-monitor and pop-out                                                                                                   | Mobile                                                                                                                     | Sharing                                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Pitwall            | 18 tiles on a 24-column grid; drag, resize, keyboard; six ready-made dashboards with Reset; text S to TV; Fit ([README][pw-readme]) | Pop out a tile or a dashboard; lap, driver, plan and compared drivers stay in sync; Pit wall preset ([dashboards][pw-dash]) | Responsive web; tiles stack on narrow screens; sticky pit board; no install, wake lock or alerts ([screenshots][pw-shots]) | Link carries the whole dashboard; export and import; fan library (mocked); lap, driver and comparison in the URL ([dashboards][pw-dash]) |
| Official F1 app    | Rotating column headers (2019); no free layout described ([2019 article][f1-lt-2019])                                               | Premium Multi View is for video ([Sports Video Group][sportsvideo]); no timing pop-out found                                | iOS and Android; 4.8 from 84K ratings in the US store ([App Store][f1-app])                                                | None found for timing                                                                                                                    |
| MultiViewer        | Setups save every window with its position and settings; editable as JSON ([setups][mv-setups])                                     | Each player and timing window is its own OS window, placed anywhere ([setups][mv-setups])                                   | None; TV only over HDMI from a computer ([download][mv-download], [FAQ][mv-faq])                                           | Setups traded on its Discord; DRM blocks video screenshots ([site][mv-site])                                                             |
| f1-dash            | Fixed; adjustable layout asked for since 2024 ([#77][f1dash-77], [#254][f1dash-254])                                                | None found                                                                                                                  | Responsive web ([repo][f1dash-gh])                                                                                         | None found                                                                                                                               |
| Nitrous            | Customise, save, sync and share layouts is an "idea" on the roadmap ([roadmap][nitrous-roadmap])                                    | Not stated                                                                                                                  | None; macOS, Linux and Windows ([site][nitrous])                                                                           | Roadmap idea only ([roadmap][nitrous-roadmap])                                                                                           |
| Undercut-F1        | Fixed screens ([README][uf1])                                                                                                       | Several terminal windows; syncs with Kodi ([README][uf1])                                                                   | None                                                                                                                       | None                                                                                                                                     |
| F1 COSMOS          | Resizable widgets and a layout setting ([site][cosmos], [live page][cosmos-live])                                                   | Not found                                                                                                                   | Claims any device ([site][cosmos])                                                                                         | Not found                                                                                                                                |
| TracingInsights    | Edit and reset chart layout, four themes, favourite drivers ([dashboard][ti-dash])                                                  | Not found                                                                                                                   | Asks phones to rotate to landscape ([site][ti])                                                                            | Download images, PDF and raw data, free to reuse; annotations and CSV ([site][ti], [note][ti-substack])                                  |
| GP Tempo           | Session, telemetry and combined views ([app][gpt-app])                                                                              | Not found                                                                                                                   | Not checked                                                                                                                | All state in the URL, so any comparison is a link ([site][gpt])                                                                          |
| Fastlytics         | Not stated on its site ([site][fastlytics])                                                                                         | Not found                                                                                                                   | Not stated                                                                                                                 | Not stated                                                                                                                               |
| Formula Live Pulse | Split screen ([App Store][flp])                                                                                                     | Not applicable                                                                                                              | Native iPhone, iPad, Apple Silicon Mac and Android ([App Store][flp])                                                      | Live chat and a predictions game ([App Store][flp])                                                                                      |
| Box Box Club       | Home and lock screen widgets, Watch, CarPlay ([App Store][bbc])                                                                     | Not applicable                                                                                                              | Native iOS ([App Store][bbc])                                                                                              | Not stated                                                                                                                               |

### Business and quality: accounts, pricing, platforms and reviews

| Product            | Accounts and sync                                                               | Pricing and monetization                                                                                                                                            | Platforms                                                             | Quality notes                                                                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pitwall            | Mocked in the browser; real sign-in and sync are plan 3 ([dashboards][pw-dash]) | Free keeps 3 own dashboards; Pro adds any number, Pro tiles and publishing; no prices set ([dashboards][pw-dash])                                                   | Web                                                                   | Not yet run on a live session; e2e and a screenshot gallery at six sizes run on the mock ([README][pw-readme])                                                                                                                                                                |
| Official F1 app    | F1 account                                                                      | App free; F1 TV Access US$3.49 a month or $29.99 a year ([F1 TV listing][f1tv-ios]); US Premium moved into Apple TV for 2026 at $12.99 a month ([IBTimes][ibtimes]) | iOS, Android, web, Apple TV, Google TV, Roku, Fire TV ([F1 TV][f1tv]) | Most polished: 4.8 from 84K ratings; 559.9 MB download ([App Store][f1-app]). Streams such as F1 TV run 20 to 45 s behind the timing data, by one integration author's estimate ([Home Assistant forum][ha-delay])                                                            |
| MultiViewer        | F1 TV sign-in; no own account found ([changelog][mv-log])                       | Free with donations; sponsors get early betas; needs paid F1 TV ([site][mv-site], [changelog][mv-log], [FAQ][mv-faq])                                               | Windows, macOS, Linux ([download][mv-download])                       | Needs a strong CPU and GPU ([requirements][mv-req]); 217 to 277 MB installers, unsigned on Windows ([download][mv-download]); recurring fixes for reconnects and F1 TV API changes ([changelog][mv-log]); its creator calls it a grey area under F1 TV terms ([iMore][imore]) |
| f1-dash            | None                                                                            | Free, AGPL, donations ([repo][f1dash-gh])                                                                                                                           | Web; self-host with Docker ([repo][f1dash-gh])                        | Sunset over IP blocks and paywalled data ([site][f1dash-site]); delay limited to time already spent on the page ([help source][f1dash-help])                                                                                                                                  |
| Nitrous            | Sign in with your own F1 account inside the app ([site][nitrous])               | Free with no live timing paywall; some app features may be limited ([site][nitrous])                                                                                | macOS, Linux, Windows ([site][nitrous])                               | New; no reviews found                                                                                                                                                                                                                                                         |
| Undercut-F1        | F1 TV login through a webview ([README][uf1])                                   | Free, GPL ([repo][uf1])                                                                                                                                             | Windows, macOS, Linux; dotnet, Homebrew, Docker ([README][uf1])       | Monthly releases ([releases][uf1-releases]); some Windows installs were flagged or hung ([HN][hn-uf1-win]); delay applies only to data received after you join ([HN][hn-uf1-delay])                                                                                           |
| F1 COSMOS          | No sign-in ([site][cosmos])                                                     | Free forever; support link ([site][cosmos])                                                                                                                         | Web                                                                   | Delay control synced well to TV; at three times normal race traffic, panels stopped updating every 5 to 10 minutes ([HN][hn-cosmos])                                                                                                                                          |
| TracingInsights    | None seen                                                                       | Free; Patreon, GitHub Sponsors, Buy Me a Coffee ([data][ti-data])                                                                                                   | Web                                                                   | Data 30 minutes after a session ([site][ti]); within-sector telemetry shape is estimated ([site][ti])                                                                                                                                                                         |
| GP Tempo           | None                                                                            | Free; optional memberships at AU$5, 15 or 30 a month with no feature gates ([membership][gpt-member])                                                               | Web                                                                   | FastF1-derived deltas can disagree with official sector times ([F1Technical][f1t-forum])                                                                                                                                                                                      |
| Fastlytics         | Email or Google ([site][fastlytics])                                            | Free tier; Pro US$5.99 a month ([site][fastlytics])                                                                                                                 | Web                                                                   | No independent reviews found                                                                                                                                                                                                                                                  |
| Formula Live Pulse | Not stated                                                                      | Free with ads; US$3.99 a month or $39.99 a year ([App Store][flp])                                                                                                  | iOS, iPadOS, macOS, Android ([App Store][flp])                        | 4.1 from 13 ratings in the US store ([App Store][flp])                                                                                                                                                                                                                        |
| Box Box Club       | Not stated                                                                      | Free; Pro, Ultra and lifetime purchases ([App Store][bbc])                                                                                                          | iOS, watchOS ([App Store][bbc])                                       | 4.5 from 136 ratings in the Norway store; claims over 4 million fans ([App Store][bbc])                                                                                                                                                                                       |

### Also seen

- **Rerace:** free web tower with gaps, sectors, tyres, race control, radio and weather, updated
  within seconds by its own claim; it also links streams and replays whose rights we did not check
  ([Rerace][rerace]).
- **Race Telemetry:** free, donation-funded, built on OpenF1; replays from 2023 on a GPS map,
  two-driver telemetry by corner and a what-if pit simulator ([site][racetel]).
- **f1-telemetry:** open-source web dashboard with a 60 fps interpolated track map, a stint
  timeline, qualifying cut-off lines and up to 3 minutes of delay; the hosted copy is down over
  F1 IP blocks ([repo][f1tel-gh]).
- **iOS newcomers:** F101 (telemetry traces, transcribed radio) ([site][f101]), Lights Out
  (widgets, spoiler delay, US$4.99 a year) ([App Store][lightsout]) and Telemetry Buddy
  (post-race only) ([App Store][telbuddy]).
- **"Pitwall" is taken several times:** an iOS app "Pitwall: F1 Companion" from June 2026
  ([App Store][pitwall-ios]), a macOS menu bar app ([HN][hn-pitwall-mac]) and an f1-dash fork
  ([repo][pitwall-gh]). Relevant to the brand decision; no recommendation here.

## Visual insights catalogue

What each product draws, and how well. "After" means post-session only.

| Visualization                        | Who has it                                                                                                                                                                                                                     | Live or after                            | How well it is done                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Track map with car positions         | Official ([App Store][f1-app]), MultiViewer ([site][mv-site]), Nitrous ([site][nitrous]), Undercut-F1 ([README][uf1]), F1 COSMOS ([live page][cosmos-live]), f1-telemetry ([repo][f1tel-gh]), Race Telemetry ([site][racetel]) | Live (with F1 TV) and replay             | Dots with labels everywhere; f1-telemetry interpolates at 60 fps. Nobody ties gaps or strategy to the map. Pitwall has none                                                          |
| Marshal-sector status on the map     | MultiViewer ([site][mv-site])                                                                                                                                                                                                  | Live                                     | Only one product, desktop only and behind F1 TV                                                                                                                                      |
| Track dominance or mini-sector map   | GP Tempo ([site][gpt]), Fastlytics ([site][fastlytics])                                                                                                                                                                        | After                                    | Per lap, after the session; Fastlytics colours whole sectors, which is coarse. Nobody does it live in qualifying                                                                     |
| Speed, throttle, brake, gear, RPM    | GP Tempo, TracingInsights, Fastlytics, Race Telemetry, Nitrous, official (Access), MultiViewer gauge ([site][gpt], [site][ti], [site][fastlytics], [site][racetel], [site][nitrous], [App Store][f1-app], [changelog][mv-log]) | After; live only as gauges               | TracingInsights has the richest interaction we saw (zoom, markers, corners) but estimates shape inside each sector from 3.7 Hz samples ([site][ti], [data][ti-data])                 |
| Lap delta along the lap              | TracingInsights ([site][ti]), Fastlytics ([site][fastlytics])                                                                                                                                                                  | After                                    | Scaled to sector endpoints, so the curve inside a sector is estimated ([site][ti]); a forum user found a FastF1 delta that disagreed with official timing ([F1Technical][f1t-forum]) |
| Speed or gear colours on the circuit | FastF1 examples ([gallery][fastf1-gallery]); TracingInsights heat map, content unverified ([site][ti])                                                                                                                         | After                                    | Static images from scripts; no interactive version found                                                                                                                             |
| Race trace (gap to a reference)      | MultiViewer ([race trace][mv-trace]), TracingInsights ([site][ti]), Pitwall gap chart ([screenshots][pw-shots])                                                                                                                | MultiViewer live; others after or replay | MultiViewer is the benchmark: mini-sector resolution, three projections, whole-field tooltip; races and sprints only, with documented spikes and gaps ([race trace][mv-trace])       |
| Lap time chart                       | MultiViewer ([changelog][mv-log]), TracingInsights ([site][ti]), F1 COSMOS ([site][cosmos]), Pitwall ([screenshots][pw-shots])                                                                                                 | Live and after                           | TracingInsights hides outliers and corrects for fuel; Pitwall drops neutralised laps and marks them                                                                                  |
| Position chart                       | TracingInsights ([site][ti]), MultiViewer lap chart, still in progress ([changelog][mv-log]), Undercut-F1 ([README][uf1]), Pitwall ([README][pw-readme])                                                                       | Live and after                           | Solid where it exists; nobody marks why a position changed (pit, overtake, penalty) on the line                                                                                      |
| Gap and interval over time           | Undercut-F1, last 15 laps ([README][uf1]); Pitwall battle chart with DRS band ([screenshots][pw-shots])                                                                                                                        | Live                                     | Short windows only; nobody projects when a chaser reaches the one-second window                                                                                                      |
| Lap time heatmap or distribution     | TracingInsights clickable heatmap ([site][ti]), Fastlytics ([site][fastlytics]), FastF1 ([gallery][fastf1-gallery])                                                                                                            | After                                    | TracingInsights' heatmap that opens lap telemetry is the best idea in the set                                                                                                        |
| Tyre degradation curves              | TracingInsights ([site][ti]), Fastlytics ([site][fastlytics]), Pitwall tyre wear per stint ([screenshots][pw-shots])                                                                                                           | After; Pitwall per lap in replay         | Competitors show curves after the race; Pitwall shows a number per stint, not a curve                                                                                                |
| Strategy timeline (stints)           | TracingInsights, Fastlytics, f1-telemetry, Undercut-F1, Race Telemetry, Pitwall ([site][ti], [site][fastlytics], [repo][f1tel-gh], [README][uf1], [site][racetel], [screenshots][pw-shots])                                    | Live and after                           | Common and well done; f1-telemetry marks the mandatory stop                                                                                                                          |
| Pit stop durations                   | MultiViewer ([changelog][mv-log]), F1 COSMOS ([live page][cosmos-live]), TracingInsights ([site][ti]), Pitwall ([screenshots][pw-shots])                                                                                       | Live and after                           | Lane and stationary times are shown; nobody shows the full race-time cost of a stop at that circuit                                                                                  |
| Undercut, overcut, pit window        | MultiViewer pit prediction ([site][mv-site]), Fastlytics claims ([site][fastlytics]), Race Telemetry what-if ([site][racetel]), Pitwall Box now ([dashboards][pw-dash])                                                        | Live (MultiViewer, Pitwall); after       | Fastlytics does not say how it computes; Race Telemetry is a beta replay tool; none explains after the fact why an undercut worked                                                   |
| Championship prediction              | MultiViewer window ([changelog][mv-log]), TracingInsights contenders and what-if ([site][ti]), FastF1 ([gallery][fastf1-gallery])                                                                                              | MultiViewer live; others after           | Lists and tables; no chart of how each position change moves the title fight during the race                                                                                         |
| Overtakes                            | TracingInsights page and race trace markers ([site][ti])                                                                                                                                                                       | After                                    | One product; the feed's `OvertakeSeries` is otherwise unused                                                                                                                         |
| G-force and cornering                | TracingInsights GG plot, peak G, corner analysis ([site][ti])                                                                                                                                                                  | After                                    | Unique to TracingInsights; derived from 3.7 Hz samples ([data][ti-data]), so peaks are smoothed                                                                                      |
| Weather                              | F1 COSMOS with hourly forecast ([live page][cosmos-live]), f1-telemetry ([repo][f1tel-gh]), TracingInsights track temperature ([site][ti]), Pitwall ([screenshots][pw-shots])                                                  | Live and after                           | Numbers, a track temperature chart and a forecast strip; no radar found                                                                                                              |
| Race control and incidents           | Nearly all; MultiViewer adds an investigations tracker ([changelog][mv-log]); TracingInsights and F1 COSMOS show FIA documents ([site][ti], [site][cosmos])                                                                    | Live                                     | Lists everywhere; Pitwall filters by flags, stewards and the followed driver                                                                                                         |
| Team radio                           | Undercut-F1 with local transcripts ([README][uf1]), MultiViewer AI transcripts ([changelog][mv-log]), official (Access) ([App Store][f1-app]), Formula Live Pulse ([App Store][flp])                                           | Live and replay                          | Undercut-F1 says its transcript accuracy is fairly low ([README][uf1])                                                                                                               |
| Replay with an animated map          | Race Telemetry at 4 to 16 times speed ([site][racetel]), Nitrous ([site][nitrous]), Fastlytics, 5 minutes free ([site][fastlytics])                                                                                            | Replay                                   | Race Telemetry is the most complete but has no live mode                                                                                                                             |

### Visualizations nobody does well yet

Each one uses topics the official archive already serves ([race index][archive-baku]).
`Position.z` and `CarData.z` carry 3 to 4 samples a second per car, measured on the 2025 Las Vegas
race ([race index][archive-lv]). Ranked by attraction times insight value.

| #   | Visualization                 | What it shows                                                                                                               | Archive topics                                                        | Attraction | Insight |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------- | ------- |
| 1   | Battle map                    | The followed driver's fight on the circuit: cars ahead and behind with live intervals, closing rate and laps until in range | `Position.z`, `TimingData`, `DriverRaceInfo` (`Catching`)             | High       | High    |
| 2   | Pit rejoin on the map         | Where the car would come out if it boxed now, drawn on the track between the real cars, moving each mini sector             | `Position.z`, `PitStopSeries`, `TimingData`                           | High       | High    |
| 3   | Race story ribbon             | One lane per lap with overtakes, stops, flags, penalties and radio; click to jump the replay                                | `OvertakeSeries`, `PitStopSeries`, `RaceControlMessages`, `TeamRadio` | High       | High    |
| 4   | Live mini-sector dominance    | The circuit coloured by the quickest of the compared drivers per mini sector, updating through qualifying                   | `TimingData` segments, `Position.z`                                   | High       | High    |
| 5   | Undercut ledger               | For each stop exchange: in-lap, stop, out-lap and net places, as a waterfall that explains who won and why                  | `PitStopSeries`, `TimingData`, `LapSeries`, `TyreStintSeries`         | Medium     | High    |
| 6   | Lap delta by distance         | Time gained or lost corner by corner, aligned on real distance from position data rather than estimated within sectors      | `CarData.z`, `Position.z`                                             | Medium     | High    |
| 7   | Tyre life and crossover       | Fuel-corrected wear curves per compound, the cliff, and the lap a fresh tyre beats the old one                              | `TyreStintSeries`, `TimingData`, `TimingAppData`                      | Medium     | High    |
| 8   | Championship swing            | Projected standings as the race runs, and how much each place is worth to each contender                                    | `ChampionshipPrediction`, `DriverRaceInfo`                            | High       | Medium  |
| 9   | Flag map                      | Yellow and red marshal sectors painted on the circuit with the message that raised them                                     | `RaceControlMessages` (sector scope), `TrackStatus`, `Position.z`     | Medium     | Medium  |
| 10  | Wind on the straights         | Head or tailwind per straight from wind direction, with track temperature against pace                                      | `WeatherDataSeries`, `Position.z`, `TimingData`                       | Medium     | Medium  |
| 11  | Speed and gear on the circuit | Interactive per-lap colouring with speed traps, for any driver and lap                                                      | `CarData.z`, `Position.z`, `TimingData` speeds                        | Medium     | Medium  |
| 12  | Pit crew league               | Stationary stop times by team, per race and across the season                                                               | `PitStopSeries`                                                       | Medium     | Low     |

Live use of 1, 2, 8 and 11 needs topics the feed now gates behind F1 TV (positions, car data,
championship tables); 4 and 9 need only a circuit outline, which the archive provides. All of them
work on replays ([Undercut-F1 README][uf1]).

## Where Pitwall already leads

On mock data today; each lead counts once [plan 1][pw-plan1] brings real sessions.

1. **Layout freedom on the web.** 18 tiles on a 24-column grid with drag, resize, keyboard
   control and six ready-made dashboards. The closest are MultiViewer's desktop setups
   ([setups][mv-setups]), F1 COSMOS' resizable widgets ([site][cosmos]) and TracingInsights'
   chart layout ([dashboard][ti-dash]). f1-dash never shipped one ([#77][f1dash-77]) and Nitrous
   lists it as an idea ([roadmap][nitrous-roadmap]).
2. **Sharing a whole dashboard.** A link carries the layout, export and import move it as a file,
   and the library previews fan dashboards. No competitor shares layouts: MultiViewer users trade
   setups on Discord ([site][mv-site]); GP Tempo shares one comparison per link ([site][gpt]).
3. **Synced windows from a browser, sized for any screen.** Pop-outs stay on the same lap and
   driver, and Fit plus text size S to TV serve a wall monitor. Only desktop apps offer several
   windows ([setups][mv-setups]).
4. **Strategy insight while the race runs.** Box now with the ghost row, true pace, tyre wear per
   stint, stops against a typical stop, and the battle chart. MultiViewer's pit prediction needs
   F1 TV ([site][mv-site]); TracingInsights and Fastlytics wait for the session to end
   ([site][ti], [site][fastlytics]).
5. **One app from phone to wall.** The same dashboards stack on a phone with a pit board for the
   followed driver. MultiViewer, Nitrous and Undercut-F1 have no phone version, and
   TracingInsights asks for landscape ([site][ti]).

## Gap backlog

Ranked by value to a paying fan; sources for "Who has it" are in the matrix and catalogue above.
Effort for one engineer once plan 1's pipeline exists: **S** up to 2 days, **M** about a week,
**L** two weeks or more. "Owner" means the item needs an
owner decision or an outside account before it can ship as described. Every item that shows F1
data in a paid product also waits on the data-rights agreement, an owner item already on the
list; the column marks only decisions beyond that.

| #   | Gap                                                                                              | Who has it                                                                                                    | User value                                                                   | Effort | Owner                                           |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| 1   | Real data: live sessions and replay of any 2025 or 2026 session                                  | Everyone in the matrix                                                                                        | Nothing else matters without it; today one race is modelled                  | L      | No; already plan 1                              |
| 2   | Track map with car positions, replay first                                                       | Official, MultiViewer, Nitrous, Undercut-F1, F1 COSMOS, Race Telemetry                                        | The most expected visual; base for battle map, rejoin and flag map           | M      | Yes: live positions need the user's F1 TV login |
| 3   | Qualifying, sprint and practice views: knockout line, best-lap order, live mini-sector dominance | f1-telemetry cut-off lines; every live tower covers all sessions; dominance only after the session (GP Tempo) | Half the weekend's sessions are not races                                    | M      | No                                              |
| 4   | Broadcast delay that syncs at once, even when joining late                                       | MultiViewer, Undercut-F1, f1-dash, F1 COSMOS, f1-telemetry                                                    | No spoilers ahead of the TV; competitors only delay data seen after you join | M      | No                                              |
| 5   | Car telemetry traces and lap delta by real distance                                              | GP Tempo, TracingInsights, Fastlytics, Race Telemetry, Nitrous, official                                      | The core analysis fans compare products on                                   | L      | Yes: live car data needs F1 TV; replays do not  |
| 6   | Catch-up and spoiler-free mode: start a live session from lap 1, hide results                    | Official app, "Pitwall: F1 Companion" (iOS), Lights Out                                                       | Fans in far time zones watch late                                            | M      | No                                              |
| 7   | Battle map and pit rejoin on the map                                                             | Nobody                                                                                                        | Shows the followed driver's fight and stop in one glance                     | M      | Yes: live positions need F1 TV                  |
| 8   | Real accounts and cross-device dashboard sync                                                    | Official, Fastlytics                                                                                          | Paying fans expect their setup on every device                               | M      | Yes: auth and email accounts; already plan 3    |
| 9   | Race story ribbon with overtakes, stops, flags and radio; click to jump                          | TracingInsights shows overtakes after the session                                                             | Replays become navigable; explains the race                                  | M      | No                                              |
| 10  | 2026 rules: straight-mode zones and overtake-mode points instead of DRS cues                     | MultiViewer                                                                                                   | Pitwall's DRS badges and band are wrong for 2026 cars                        | S      | No                                              |
| 11  | Mini sectors and speed traps in the tower                                                        | MultiViewer, f1-dash, f1-telemetry, F101                                                                      | Qualifying is read in mini sectors                                           | S      | No                                              |
| 12  | Undercut ledger and full pit-stop cost per circuit                                               | Nobody; Race Telemetry has a what-if after the race                                                           | Explains strategy calls, the main reason fans open analysis                  | M      | No                                              |
| 13  | Tyre life curves and crossover lap                                                               | TracingInsights and Fastlytics, after the session                                                             | Turns the wear number into a pit-window read                                 | S      | No                                              |
| 14  | Championship swing during the race                                                               | MultiViewer list; TracingInsights after the race                                                              | The story of the season's last races                                         | S      | Yes: live championship data needs F1 TV         |
| 15  | Installable phone app and screen wake lock                                                       | Native apps (official, Formula Live Pulse, Box Box Club)                                                      | A phone on the sofa must not sleep mid-race                                  | S      | No                                              |
| 16  | Alerts for the followed driver: stop, flag, penalty, session start                               | Box Box Club, "Pitwall: F1 Companion" (iOS), Lights Out                                                       | Brings fans back at the right moment                                         | M      | Yes: push service keys                          |
| 17  | Team radio with transcripts                                                                      | MultiViewer, Undercut-F1, official, Formula Live Pulse, F101                                                  | Context for strategy and incidents                                           | M      | Yes: radio audio is F1 media, like the pictures |
| 18  | Season context: calendar in local time and standings                                             | Official, Box Box Club, F1 COSMOS, Fastlytics                                                                 | Answers "when is the next session" without leaving                           | S      | No                                              |
| 19  | History from 2018                                                                                | TracingInsights, Fastlytics Pro                                                                               | Season-to-season comparisons                                                 | M      | No                                              |
| 20  | Flag map and wind on the straights                                                               | MultiViewer flag map only                                                                                     | Explains slow sectors and lap time drift                                     | S      | No                                              |

Considered and left out of the top 20: video streams inside tiles (MultiViewer; its creator calls
it a grey area under F1 TV terms, [iMore][imore]), other series, more languages, chart image and
CSV export, FIA documents, G-force plots, pit crew league, rain radar, and prediction games or chat.

## Quality bars to meet

- **Latency, feed to screen.** OpenF1 lands about 3 s after the event, with positions and
  intervals every 4 s ([OpenF1][openf1]); Rerace claims a few seconds ([Rerace][rerace]). Plan 1
  targets about 1 s from the feed ([plan 1][pw-plan1]), which beats every published figure.
- **Latency, matching the TV.** Streams such as F1 TV run 20 to 45 s behind the timing data,
  broadcast TV 5 to 10 s and some pay-TV apps 45 to 60 s, by one integration author's estimate
  ([Home Assistant forum][ha-delay]). MultiViewer defaults to 30 to 40 s and steps by 1 s or 0.1 s
  ([syncing][mv-sync]); f1-telemetry allows up to 180 s ([repo][f1tel-gh]). f1-dash and
  Undercut-F1 cannot delay past the moment you opened them ([help source][f1dash-help],
  [HN][hn-uf1-delay]), so syncing at once is a bar nobody meets.
- **Startup.** No competitor publishes a startup time. The alternatives are installs of 117.8 MB
  (F1 TV, [F1 TV listing][f1tv-ios]), 217 to 277 MB (MultiViewer, [download][mv-download]) and
  559.9 MB (official app, [App Store][f1-app]); F1 COSMOS opens with no sign-in ([site][cosmos]).
  The bar: a shared link shows live data before an installed app would finish opening.
- **Mobile usability.** The official app holds 4.8 from 84K ratings ([App Store][f1-app]).
  Reviews of its 2018 redesign punished a tower that showed six drivers per screen
  ([App Store][f1-app]). F1's 2018 fan survey found over half of fans use a phone for live
  timing, and their feedback made F1 show all 20 drivers instead of 14
  ([F1 survey][fan-survey-2018]). The bar: all 20 drivers readable in portrait at 360 px, the
  followed driver always visible, the screen kept awake, and no spoilers on open.
- **Reliability on race day.** F1 COSMOS saw three times normal traffic during a race and its
  panels stalled every 5 to 10 minutes ([HN][hn-cosmos]); MultiViewer shipped a fix for constant
  reconnects in July 2026 ([changelog][mv-log]). The bar: no stalled tile through a full race at
  peak load, automatic reconnect and resync, and a visible marker when data is stale.

[pw-readme]: ../../README.md
[pw-dash]: ../product/dashboards.md
[pw-shots]: ../screenshots.md
[pw-plan1]: ../plans/01-real-data.md
[archive-baku]: https://livetiming.formula1.com/static/2026/2026-09-26_Azerbaijan_Grand_Prix/2026-09-26_Race/Index.json
[archive-lv]: https://livetiming.formula1.com/static/2025/2025-11-22_Las_Vegas_Grand_Prix/2025-11-22_Race/Index.json
[cloud-403]: https://github.com/emsqrd/f1fantasyapp/issues/437
[openf1]: https://openf1.org
[f1-app]: https://apps.apple.com/us/app/formula-1/id835022598
[f1tv-ios]: https://apps.apple.com/app/id1315007279
[f1tv]: https://f1tv.formula1.com/
[f1-lt-2019]: https://www.formula1.com/en/latest/article/f1-live-timing-bigger-and-better-than-ever.3wTlvar6VFvyDbm8GWnyMM
[fan-survey-2018]: https://www.formula1.com/en/latest/article/f1-fan-voice-you-have-your-say-on-the-f1-live-timing-app-and-more.43JSFh5ECkqqO0EqE8SmGM
[sportsvideo]: https://www.sportsvideo.org/2025/03/11/f1-tv-launches-new-f1-tv-premium-subscription-tier/
[ibtimes]: https://www.ibtimes.co.uk/formula-1-apple-tv-us-fans-2026-1810727
[ha-delay]: https://community.home-assistant.io/t/formula-1-racing-sensor/880842/25
[mv-site]: https://multiviewer.app
[mv-log]: https://multiviewer.app/changelog
[mv-faq]: https://multiviewer.app/docs/getting-started/faq
[mv-setups]: https://multiviewer.app/docs/configuration/setups
[mv-req]: https://multiviewer.app/docs/getting-started/requirements
[mv-sync]: https://multiviewer.app/docs/usage/syncing-streams
[mv-trace]: https://multiviewer.app/docs/usage/race-trace
[mv-download]: https://multiviewer.app/download
[imore]: https://www.imore.com/music-movies-tv/multiviewer-for-f1-the-fan-built-formula-1-app-so-popular-even-f1-teams-use-it
[f1dash-gh]: https://github.com/slowlydev/f1-dash
[f1dash-site]: https://f1-dash.com/
[f1dash-37]: https://github.com/slowlydev/f1-dash/issues/37
[f1dash-77]: https://github.com/slowlydev/f1-dash/issues/77
[f1dash-254]: https://github.com/slowlydev/f1-dash/issues/254
[f1dash-272]: https://github.com/slowlydev/f1-dash/issues/272
[f1dash-help]: https://github.com/slowlydev/f1-dash/blob/main/dashboard/src/app/(nav)/help/page.tsx
[nitrous]: https://nitrous.software/
[nitrous-roadmap]: https://nitrous.software/roadmap
[uf1]: https://github.com/JustAman62/undercut-f1
[uf1-releases]: https://github.com/JustAman62/undercut-f1/releases
[hn-uf1-delay]: https://news.ycombinator.com/item?id=43738008
[hn-uf1-win]: https://news.ycombinator.com/item?id=43736220
[cosmos]: https://f1cosmos.com/
[cosmos-live]: https://f1cosmos.com/dashboard/live
[hn-cosmos]: https://news.ycombinator.com/item?id=44777152
[ti]: https://tracinginsights.com
[ti-dash]: https://tracinginsights.com/dashboard
[ti-substack]: https://substack.com/@tracinginsights/note/c-177873106
[ti-data]: https://www.mintlify.com/TracingInsights/2026/data-sources
[gpt]: https://gp-tempo.com
[gpt-app]: https://gp-tempo.com/app
[gpt-member]: https://buymeacoffee.com/f1tempo/membership
[f1t-forum]: https://www.f1technical.net/forum/viewtopic.php?p=1118915
[fastlytics]: https://fastlytics.app
[fastf1-gallery]: https://docs.fastf1.dev/gen_modules/examples_gallery/index.html
[flp]: https://apps.apple.com/us/app/formula-live-pulse/id6739639442
[bbc]: https://apps.apple.com/no/app/id1621241916
[rerace]: https://rerace.net/f1/live-timing/
[racetel]: https://www.racetelemetry.com/
[f1tel-gh]: https://github.com/matteocelani/f1-telemetry
[f101]: https://f101app.com/
[lightsout]: https://apps.apple.com/app/6755430566
[telbuddy]: https://apps.apple.com/us/app/telemetry-buddy/id6755110726
[pitwall-ios]: https://apps.apple.com/app/id6762566510
[hn-pitwall-mac]: https://news.ycombinator.com/item?id=47349205
[pitwall-gh]: https://github.com/ignaciohaffner/pitwall
