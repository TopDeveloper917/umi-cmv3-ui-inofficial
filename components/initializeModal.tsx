import { createLutForCandyMachineAndGuard } from "../utils/createLutForCandyGuard";
import { Box, Button, HStack, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper, SimpleGrid, Text, UseToastOptions, VStack } from "@chakra-ui/react";
import { CandyGuard, CandyMachine, getMerkleRoot, route } from "@metaplex-foundation/mpl-candy-machine";
import { Umi, publicKey, sol, some, transactionBuilder } from "@metaplex-foundation/umi";
import { transferSol, addMemo } from '@metaplex-foundation/mpl-toolbox';
import React from "react";
import { useEffect, useState } from "react";
import { allowLists } from "@/allowlist";

// new function createLUT that is called when the button is clicked and which calls createLutForCandyMachineAndGuard and returns a success toast
const createLut = (umi: Umi, candyMachine: CandyMachine, candyGuard: CandyGuard, recentSlot: number, toast: (options: Omit<UseToastOptions, "id">) => void) => async () => {
    const [builder, AddressLookupTableInput] = await createLutForCandyMachineAndGuard(umi, recentSlot, candyMachine, candyGuard);
    try {
        const { signature } = await builder.sendAndConfirm(umi, {
            confirm: { commitment: "processed" }, send: {
                skipPreflight: true,
            }
        });
        toast({
            title: "LUT created",
            description: `LUT ${AddressLookupTableInput.publicKey} created. Add it to your .env NEXT_PUBLIC_LUT NOW! This UI does not work properly without it!`,
            status: "success",
            duration: 99999999,
            isClosable: true,
        });        
    } catch (e) {
        toast({
            title: "creating LUT failed!",
            description: `Error: ${e}`,
            status: "error",
            duration: 99999999,
            isClosable: true,
        });   
    }
}

const initializeGuards = (umi: Umi, candyMachine: CandyMachine, candyGuard: CandyGuard, toast: (options: Omit<UseToastOptions, "id">) => void) => async () => {
    if (!candyGuard.groups) {
        return;
    }
    candyGuard.groups.forEach(async (group) => {
        let builder = transactionBuilder();
        if (group.guards.freezeSolPayment.__option === "Some" || group.guards.freezeTokenPayment.__option === "Some") {
            toast({
                title: "FreezeSolPayment",
                description: `Make sure that you ran sugar freeze initialize!`,
                status: "success",
                duration: 99999999,
                isClosable: true,
            });
        }
        if (group.guards.allocation.__option === "Some") {
            builder = builder.add(
                route(umi, {
                    guard: "allocation",
                    candyMachine: candyMachine.publicKey,
                    candyGuard: candyMachine.mintAuthority,
                    group:
                        some(group.label),
                    routeArgs: {
                        candyGuardAuthority: umi.identity,
                        id: group.guards.allocation.value.id,
                    },
                }))

        }
        if (builder.items.length > 0) {
            builder.sendAndConfirm(umi, {
                confirm: { commitment: "processed" }, send: {
                    skipPreflight: true,
                }
            })
            toast({
                title: "routes created",
                status: "success",
                duration: 99999999,
                isClosable: true,
            });
        } else {
            toast({
                title: "Nothing to create here",
                status: "info",
                duration: 99999999,
                isClosable: true,
            });
        }

    });
}

const buyABeer = (umi: Umi, amount: string, toast: (options: Omit<UseToastOptions, "id">) => void) => async () => {
    amount = amount.replace(" SOL", "");

    let builder = transactionBuilder()
        .add(addMemo(umi, { memo: "🍻" }))
        .add(transferSol(umi, { destination: publicKey("BeeryDvghgcKPTUw3N3bdFDFFWhTWdWHnsLuVebgsGSD"), amount: sol(Number(amount)) }))

    try {

        await builder.sendAndConfirm(umi, {
            confirm: { commitment: "processed" }, send: {
                skipPreflight: true,
            }
        });

        toast({
            title: "Thank you! 🍻",
            description: `Lets have a 🍺 together!`,
            status: "success",
            duration: 99999999,
            isClosable: true,
        });

    } catch (e) {
        console.error(e)

    }
}


function BuyABeerInput({ value, setValue }: { value: string, setValue: React.Dispatch<React.SetStateAction<string>> }) {
    const format = (val: string) => val + ' SOL'
    const parse = (val: string) => val.replace(/^\$/, '')

    return (
        <>
            <NumberInput mr='2rem' value={format(value)} onChange={(valueString) => setValue(parse(valueString))} step={0.5} precision={2} keepWithinRange={true} min={0}>
                <NumberInputField />
                <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                </NumberInputStepper>
            </NumberInput>
        </>
    )
}

type Props = {
    umi: Umi;
    candyMachine: CandyMachine;
    candyGuard: CandyGuard | undefined;
    toast: (options: Omit<UseToastOptions, "id">) => void;
};

export const InitializeModal = ({ umi, candyMachine, candyGuard, toast }: Props) => {
    const [recentSlot, setRecentSlot] = useState<number>(0);
    const [amount, setAmount] = useState<string>("5")


    useEffect(() => {
        (async () => {
            setRecentSlot(await umi.rpc.getSlot())
        })();
    }, [umi]);

    if (!candyGuard) {
        console.error("no guard defined!")
        return <></>
    }

    //key value object with label and roots
    const roots = new Map<string, string>();

    allowLists.forEach((value, key) => {
        //@ts-ignore
        const root =  getMerkleRoot(value).toString("hex");
        if (!roots.has(key)) {
            roots.set(key, root)
        }
    });

    //put each root into a <Text> element
    const rootElements = Array.from(roots).map(([key, value]) => {
        return <Box key={key}><Text fontWeight={"semibold"} key={key}>{key}:</Text><Text>{value}</Text></Box>
    })

    return (
        <><VStack>
            <HStack>
                <Button onClick={createLut(umi, candyMachine, candyGuard, recentSlot, toast)}>Create LUT</Button>
                <Text>Reduces transaction size errors</Text>
            </HStack>
            <HStack>
                <Button onClick={initializeGuards(umi, candyMachine, candyGuard, toast)}>Initialize Guards</Button>
                <Text>Required for some guards</Text>
            </HStack>
            <HStack>
                <BuyABeerInput value={amount} setValue={setAmount} />
                <Button onClick={buyABeer(umi, amount, toast)}>Buy me a Beer 🍻</Button>
            </HStack>
            {rootElements.length > 0 && <Text fontWeight={"bold"}>Merkle trees for your config.json:</Text>}
            {rootElements.length > 0 && rootElements}
        </VStack></>
    );
}
