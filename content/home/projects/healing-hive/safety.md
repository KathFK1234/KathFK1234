# Safety — the decisions a mental-health product cannot get wrong

Most software can fail politely. This one has a few moments where it cannot fail at all. These are the rules v2 is built around.

1. Help never depends on a third party being up.
   If a message sounds like crisis and the AI provider is slow, down, or switched off, the person still gets a caring reply and the helplines. The crisis contacts also live inside the web app, so the help page works when the server does not.

2. Screen broadly.
   The first check for crisis language is deliberately wide, in English and Swahili. Showing helplines to someone who did not need them costs little. Missing someone who did is the cost that matters.

3. Say what the AI is not.
   Not a therapist, not a doctor, not a human. It never diagnoses or advises on medication, and it points to a person when a person is needed.

4. Private means private from us too.
   Admins see counts. There is no route into anyone's journal, check-ins, or AI conversation, and a person can clear their conversation whenever they like.

5. A professional is someone we checked.
   Nobody appears in the directory until an admin has approved their application.

The helpline numbers are re-checked before every release. A wrong number is worse than none.

See also: ../mindconnect/product/care-checkpoints.md
