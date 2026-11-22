"""Generates the demo walkie clips (Microsoft neural voices via edge-tts). Demo audio, not real crew.
Usage: python scripts/make-voices.py   (writes public/clips/*.mp3)
"""
import asyncio
import os
import edge_tts

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'clips')
F, F2, M = 'en-IN-NeerjaNeural', 'en-IN-NeerjaExpressiveNeural', 'en-IN-PrabhatNeural'

CLIPS = [
    # Mic Drop (Bangalore cafe open mic)
    ('smera-wrap', F, '+0Hz', 'Smera to all teams. Raahe is on stage now. Great work tonight, everyone. We pack down right after the set.'),
    ('niharika-tissue', F2, '+2Hz', 'Hi, Niharika here. Washroom is restocked, and the kitchen is closed, so the counter is doing drinks only.'),
    ('rj-closing', M, '+4Hz', 'RJ here. Last open mic slot is done. Handing over to Raahe in two minutes.'),
    ('shashi-mics', M, '-6Hz', 'Shashi on sound. Both mics are clean now. Raahe is on channel one, guitar on the D I.'),
    ('vaibhav-door', M, '-2Hz', 'Vaibhav on the door. We are at full house. One in, one out from now. Footpath is clear.'),
    ('divyansh-merch', M, '+8Hz', 'Divyansh here. The card reader at the merch table is paired again. Card and U P I both working.'),
    # Sundown Sessions demo crew
    ('vikram-took', M, '-3Hz', 'Thanks for taking it! Barrier B is the one on the left of the speaker stack. Please bring two people.'),
    ('vikram-copy', M, '-3Hz', 'Copy that. Two runners heading to Barrier B. Thank you.'),
    ('vikram-fixed', M, '-3Hz', 'Barrier is holding now. The crowd moved back a metre. All good.'),
    ('isha-callback', F, '+0Hz', 'Isha here, heard you loud and clear. All teams are on it.'),
    ('isha-doors', F, '+0Hz', 'All teams, doors in ten minutes. Radio check on your channels please.'),
    ('kabir-mic', M, '+3Hz', 'Sound here. Vocal mic two is crackling, I am swapping it now.'),
    ('rohan-wristbands', M, '+7Hz', 'Runner here. On my way to Gate A with a box of wristbands.'),
]


async def main():
    os.makedirs(OUT, exist_ok=True)
    for name, voice, pitch, text in CLIPS:
        await edge_tts.Communicate(text, voice, pitch=pitch, rate='+4%').save(os.path.join(OUT, name + '.mp3'))
        print('made', name)

asyncio.run(main())
