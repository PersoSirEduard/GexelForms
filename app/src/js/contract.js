// Get contract depending on language
function getContract(language) {
    if (language == "english") {
        return [
        `
         In order to optimize the management of our equipment, we have developed
         a new procedure to that effect. This means that everyone will receive a 
         set of working equipment to be kept for the duration of your employement 
         at <b>GEXEL TELECOM</b>. This equipment will be loaned to you.
        `,
        `
        You will be responsible for this equipment as the cost of this equipment is a significant investment for the Company. 
        Therefore, will be held responsible for all damaged or lost equipment. However, you will not be held liable for damages due 
        to normal wear and tear and damages covered by the warranty of the equipment. I hereby confirm that I have been informed of 
        the cost of the equipment that will be loaned to me for my usage during my employement at GEXEL and you have validated the status of these. 
        I also accept the following conditions: In case I lose the equipment, I will be held responsible for the replacement costs; In case of any 
        damages of derect to the equipment not covered by the warrenty, I will be held responsible for all replacement costs other than normal wear and tear; 
        In case of the termination of employement, I will be responsible for returning the equipment at the pick up address. Otherwise, the cost of this
        equipment will be deducted from my last paycheck.
        `];
    } else {
        return [
        `
        Chaque employé se verra remettre un emsemble d'outils de travail qu'il conservera durant son emploi chez <b>GEXEL</b>.
        Ces outils vous seront prêtés personnellement, pour votre seule utilisation.
        `,
        `
        L'achat de ces outils représente un investissement important pour la Compagnie. 
        Vous ne serez, bien entendu, pas tenu responsable pour les bris dus à l'usure, 
        les dommages normaux et ceux couverts par la garantie des équipements. Par la présente, 
        j'atteste avoir pris connaissance des coûts des équipements de travail, valider 
        l'état des équipements remis et j'accepte les conidtions suivantes: En case de perte 
        d'équipement, je suis responsable de la totalité des coûts de remplacement; En cas de 
        bris ou de défectuosité, qui ne résultent pas d'une usure normale et qui ne sont pas 
        couverts par la garantie, je suis responsable de la totalité des coûts de remplacement; 
        Dans le cas d'une cessation d'emploi, je suis responsable de remettre l'équipement en 
        main propre à l'adresse où vous avez pris possession des équipements;
        `];
    }
}