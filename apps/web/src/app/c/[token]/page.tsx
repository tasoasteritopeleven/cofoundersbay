'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Logo } from '@/components/brand/Logo';
import { BilingualText } from '@/components/common/BilingualText';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { NeedCard } from '@/components/commitments/NeedCard';
import { getPublicCommitmentCard } from '@/lib/commitments-api';
import { joinToRespondHref, signInToRespondHref } from '@/lib/commitments-links';
import { CMT } from '@/lib/i18n/strings-commitments';
import { qk } from '@/lib/query-keys';
import { MainLandmark } from '@/components/layout/AppShell';

/**
 * A need card as its author shared it, for people without an account.
 *
 * It shows the card and the author's name and headline - the product is
 * not anonymous - and nothing that reaches them outside the platform: no
 * email, no phone, no profile link to scrape. The way to respond is to join
 * (or sign in), which returns to this card's board, not to a listing wall.
 */
export default function PublicNeedCardPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');
  const query = useQuery({
    queryKey: qk('commitments', 'public', token),
    queryFn: () => getPublicCommitmentCard(token),
    enabled: Boolean(token),
    retry: false,
  });
  const card = query.data;

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-4">
        <Link href="/" aria-label="CoFounderBay">
          <Logo size="sm" />
        </Link>
        <Button size="sm" variant="ghost" asChild>
          <Link href={card ? signInToRespondHref(card.id) : '/login'}>
            <BilingualText en={CMT.public_sign_in.en} el={CMT.public_sign_in.el} compact />
          </Link>
        </Button>
      </header>
      <MainLandmark className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-16">
        {query.isLoading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : !card || !card.id ? (
          <Card>
            <CardContent className="space-y-3 text-center">
              <h1 className="text-lg font-semibold text-foreground"><BilingualText en="Need card" el="Κάρτα ανάγκης" compact /></h1>
              <p className="text-sm text-muted-foreground"><BilingualText en={CMT.public_missing.en} el={CMT.public_missing.el} wrap /></p>
              <Button size="sm" variant="outline" asChild>
                <Link href="/"><BilingualText en="Back to home" el="Επιστροφή στην αρχική" compact /></Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardContent>
                <NeedCard card={card} headingLevel={1} />
              </CardContent>
            </Card>
            <Card className="border-primary/15 bg-primary/[0.03]">
              <CardContent className="space-y-3">
                <p className="text-sm text-foreground">
                  <BilingualText en={`${CMT.public_by.en} ${card.owner.displayName}.`} el={`${CMT.public_by.el} ${card.owner.displayName}.`} wrap />
                </p>
                <p className="text-sm text-muted-foreground"><BilingualText en={CMT.public_how.en} el={CMT.public_how.el} wrap /></p>
                {card.outcome === 'open' || card.outcome === 'in_discussion' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link href={joinToRespondHref(card.id)}><BilingualText en={CMT.public_join.en} el={CMT.public_join.el} compact /></Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={signInToRespondHref(card.id)}><BilingualText en={CMT.public_sign_in.en} el={CMT.public_sign_in.el} compact /></Link>
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground"><BilingualText en={CMT.not_taking.en} el={CMT.not_taking.el} wrap /></p>
                )}
              </CardContent>
            </Card>
            <p className="text-center text-xs text-muted-foreground">
              <Link href="/privacy" className="underline-offset-4 hover:underline"><BilingualText en="Privacy" el="Απόρρητο" compact /></Link>
              {' · '}
              <Link href="/terms" className="underline-offset-4 hover:underline"><BilingualText en="Terms" el="Όροι" compact /></Link>
            </p>
          </>
        )}
      </MainLandmark>
    </div>
  );
}
